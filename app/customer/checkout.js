import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import LottieView from "lottie-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "../../src/components/AppIcon";
import ScreenContainer from "../../src/components/ScreenContainer";
import { getSelectedVariantIconColor } from "../../src/constants/variantColorMap";
import {
  DEFAULT_PAYMENT_METHOD_ID,
  PAYMENT_METHOD_PRESETS,
  normalizePaymentMethod,
} from "../../src/constants/paymentMethods";
import { useCart } from "../../src/context/CartContext";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";
import { notifyMerchantNewOrder } from "../../src/utils/notifications";
import { resolveVariantUnitPrice } from "../../src/utils/productVariants";

const CHECKOUT_FIXED_AREA_HEIGHT = 250;
const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const ICON_COLOR_POOL = [
  "#E53935",
  "#2E7D32",
  "#1E88E5",
  "#FFA700",
  "#F57C00",
];

export default function CheckoutPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart, clearCart } = useCart();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isPaying, setIsPaying] = useState(false);
  const [animationCompleted, setAnimationCompleted] = useState(false);
  const [pendingInvoiceId, setPendingInvoiceId] = useState(null);
  const [cartSnapshot, setCartSnapshot] = useState([]);
  const [productVisualsById, setProductVisualsById] = useState({});
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [defaultPaymentMethodId, setDefaultPaymentMethodId] = useState("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [paymentPickerVisible, setPaymentPickerVisible] = useState(false);

  const visibleCart = isPaying ? cartSnapshot : cart;
  const resolveCheckoutUnitPrice = useCallback(
    (item) => {
      const productData = productVisualsById[item.productId] || {};
      const basePrice =
        Number(productData.basePrice ?? item.price ?? 0) || 0;
      return Number(
        resolveVariantUnitPrice(basePrice, productData.variants, item.selectedOptions),
      );
    },
    [productVisualsById],
  );
  const pricedVisibleCart = useMemo(
    () =>
      visibleCart.map((item) => ({
        ...item,
        resolvedUnitPrice: resolveCheckoutUnitPrice(item),
      })),
    [resolveCheckoutUnitPrice, visibleCart],
  );
  const total = pricedVisibleCart.reduce(
    (sum, item) => sum + item.resolvedUnitPrice * item.quantity,
    0,
  );
  const getRandomIconColor = useCallback(() => {
    const idx = Math.floor(Math.random() * ICON_COLOR_POOL.length);
    return ICON_COLOR_POOL[idx];
  }, []);
  const availablePaymentMethods = useMemo(() => {
    if (paymentMethods.length > 0) return paymentMethods;
    return PAYMENT_METHOD_PRESETS;
  }, [paymentMethods]);
  const resolvedDefaultPaymentMethodId = useMemo(() => {
    if (defaultPaymentMethodId) return defaultPaymentMethodId;
    return availablePaymentMethods[0]?.id || "";
  }, [availablePaymentMethods, defaultPaymentMethodId]);
  const effectivePaymentMethodId =
    selectedPaymentMethodId || resolvedDefaultPaymentMethodId;
  const effectivePaymentMethod = useMemo(
    () =>
      availablePaymentMethods.find(
        (method) => method.id === effectivePaymentMethodId,
      ) || null,
    [availablePaymentMethods, effectivePaymentMethodId],
  );

  useEffect(() => {
    const loadProductVisuals = async () => {
      try {
        const snapshot = await getDocs(collection(db, "products"));
        const visuals = {};
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          visuals[docSnap.id] = {
            iconName: data?.iconName || data?.icon || DEFAULT_PRODUCT_ICON,
            iconColor: getRandomIconColor(),
            basePrice: Number(data?.price || 0),
            variants: Array.isArray(data?.variants) ? data.variants : [],
          };
        });
        setProductVisualsById(visuals);
      } catch (error) {
        console.error("Failed to load product visuals for checkout:", error);
      }
    };

    loadProductVisuals();
  }, [getRandomIconColor]);

  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          setPaymentMethods([]);
          setDefaultPaymentMethodId("");
          return;
        }
        const userSnap = await getDoc(doc(db, "users", uid));
        const userData = userSnap.data() || {};
        const rawMethods = Array.isArray(userData.paymentMethods)
          ? userData.paymentMethods
          : [];
        const normalizedMethods = rawMethods
          .map((method, index) =>
            normalizePaymentMethod({ ...method, id: method?.id || `pm_${index}` }),
          )
          .filter(Boolean);
        const mergedMethods = PAYMENT_METHOD_PRESETS.map((preset) => {
          const existing = normalizedMethods.find((method) => method.id === preset.id);
          return existing || preset;
        });

        setPaymentMethods(mergedMethods);
        const defaultIdFromProfile = String(
          userData.defaultPaymentMethodId || DEFAULT_PAYMENT_METHOD_ID,
        );
        const defaultExists = mergedMethods.some(
          (method) => method.id === defaultIdFromProfile,
        );
        const defaultId = defaultExists
          ? defaultIdFromProfile
          : (mergedMethods[0]?.id || DEFAULT_PAYMENT_METHOD_ID);
        setDefaultPaymentMethodId(String(defaultId || ""));
      } catch (error) {
        console.error("Failed to load payment methods:", error);
        setPaymentMethods([]);
        setDefaultPaymentMethodId("");
      }
    };

    loadPaymentMethods();
  }, []);

  useEffect(() => {
    if (!animationCompleted || !pendingInvoiceId) return;
    router.replace(`/customer/invoice/${pendingInvoiceId}`);
  }, [animationCompleted, pendingInvoiceId, router]);

  const handlePay = async () => {
    try {
      if (!cart.length) {
        throw new Error("Cart is empty");
      }
      if (!effectivePaymentMethod) {
        throw new Error("No payment method available");
      }
      setCartSnapshot(cart);
      setIsPaying(true);
      setAnimationCompleted(false);
      setPendingInvoiceId(null);

      const orderRef = await addDoc(collection(db, "orders"), {
        customerId: auth.currentUser.uid,
        items: cart.map((item) => ({
          cartItemKey: item.cartItemKey || null,
          productId: item.productId,
          name: item.name,
          storeId: item.storeId || "",
          storeName: item.storeName || "",
          merchantId: item.merchantId,
          merchantName: item.merchantName,
          iconName: item.iconName || null,
          selectedVariantId: item.selectedVariantId || null,
          quantity: Number(item.quantity),
          price: Number(resolveCheckoutUnitPrice(item)),
          selectedOptions: item.selectedOptions || {},
          selectedOptionsLabel: item.selectedOptionsLabel || "",
        })),
        total: Number(total),
        paymentMethod: effectivePaymentMethod.label,
        paymentMethodId: effectivePaymentMethod.id,
        createdAt: serverTimestamp(),
      });

      const merchantIds = [
        ...new Set(cart.map((item) => item.merchantId).filter(Boolean)),
      ];

      await Promise.all(
        merchantIds.map((merchantId) =>
          notifyMerchantNewOrder({
            merchantId,
            orderId: orderRef.id,
          }),
        ),
      );

      clearCart();
      setPendingInvoiceId(orderRef.id);
    } catch (err) {
      console.error("Checkout failed:", err.message);
      setCartSnapshot([]);
      setIsPaying(false);
      setAnimationCompleted(false);
      setPendingInvoiceId(null);
    }
  };

  return (
    <ScreenContainer disableBottomInset bottomPadding={0}>
      <Text style={styles.title}>Items summary</Text>

      <View style={styles.contentWrap}>
        <ScrollView
          style={styles.itemsScroll}
          contentContainerStyle={[
            styles.itemsScrollContent,
            {
              paddingBottom:
                insets.bottom +
                CHECKOUT_FIXED_AREA_HEIGHT,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.itemsCard}>
            {pricedVisibleCart.map((item, index) => (
              <View
                key={item.cartItemKey || `${item.productId}-${index}`}
                style={[
                  styles.itemRow,
                  index !== pricedVisibleCart.length - 1 && styles.itemRowDivider,
                ]}
              >
                <View style={styles.itemLeft}>
                  <View style={styles.itemIconWrap}>
                    <AppIcon
                      name={
                        item.iconName ||
                        productVisualsById[item.productId]?.iconName ||
                        DEFAULT_PRODUCT_ICON
                      }
                      variant="community"
                      size={18}
                      color={
                        getSelectedVariantIconColor(item.selectedOptions) ||
                        productVisualsById[item.productId]?.iconColor ||
                        colors.text
                      }
                    />
                  </View>
                  <View style={styles.itemContent}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{item.name}</Text>
                      <View style={styles.qtyBadge}>
                        <Text style={styles.qtyBadgeText}>{item.quantity}</Text>
                      </View>
                    </View>
                    {item.selectedOptionsLabel ? (
                      <Text style={styles.variantText} numberOfLines={1}>
                        {item.selectedOptionsLabel}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.itemAmount}>
                  ${(item.resolvedUnitPrice * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View
          style={[
            styles.bottomPanels,
            { paddingBottom: insets.bottom },
          ]}
        >
          <View style={styles.paymentMethodRow}>
            <View style={styles.paymentMethodMeta}>
              <Text style={styles.paymentMethodLabel}>Paying with</Text>
              <View style={styles.paymentMethodValueRow}>
                <AppIcon
                  name={effectivePaymentMethod?.iconName || "credit-card-outline"}
                  variant="community"
                  size={16}
                  color={colors.text}
                />
                <Text style={styles.paymentMethodValue}>
                  {effectivePaymentMethod?.label || "No payment method"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.changeMethodBtn}
              onPress={() => setPaymentPickerVisible(true)}
              disabled={isPaying}
            >
              <Text style={styles.changeMethodText}>Change</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bottomDivider} />

          <View style={styles.checkoutFooter}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
            </View>

            {isPaying ? (
              <View style={styles.payAnimationWrap}>
              <LottieView
                source={require("../../assets/lottie/loading tick.json")}
                autoPlay
                loop={false}
                onAnimationFinish={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setAnimationCompleted(true);
                }}
                style={styles.payAnimation}
              />
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.payButton,
                  (cart.length === 0 || !effectivePaymentMethod) &&
                    styles.disabled,
                ]}
                disabled={cart.length === 0 || !effectivePaymentMethod}
                onPress={handlePay}
              >
                <AppIcon
                  name="contactless-payment-circle-outline"
                  variant="community"
                  size={20}
                  color={colors.background}
                />
                <Text style={styles.payText}>Pay ${total.toFixed(2)}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <Modal
        visible={paymentPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPaymentPickerVisible(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose payment method</Text>
            <View style={styles.methodOptionsCard}>
              {availablePaymentMethods.map((method, index) => {
                const selected = method.id === effectivePaymentMethodId;
                const isDefault = method.id === resolvedDefaultPaymentMethodId;
                const hasDivider = index < availablePaymentMethods.length - 1;
                return (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.methodOption,
                      selected && styles.methodOptionSelected,
                      hasDivider && styles.methodOptionDivider,
                    ]}
                    onPress={() => {
                      setSelectedPaymentMethodId(method.id);
                      setPaymentPickerVisible(false);
                    }}
                  >
                    <View style={styles.methodOptionLeft}>
                      <View style={styles.methodOptionTitleRow}>
                        <AppIcon
                          name={method.iconName || "credit-card-outline"}
                          variant="community"
                          size={16}
                          color={colors.text}
                        />
                        <Text style={styles.methodOptionText}>{method.label}</Text>
                      </View>
                      {isDefault ? (
                        <Text style={styles.defaultMethodText}>Default</Text>
                      ) : null}
                    </View>
                    {selected ? (
                      <AppIcon
                        name="check-circle"
                        variant="community"
                        size={20}
                        color={colors.success}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    title: {
      fontSize: 24,
      fontWeight: "600",
      marginBottom: 16,
      color: colors.text,
    },
    contentWrap: {
      flex: 1,
    },
    itemsScroll: {
      flex: 1,
    },
    itemsScrollContent: {
      paddingBottom: 12,
    },
    itemsCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      overflow: "hidden",
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 20,
    },
    itemRowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    itemLeft: {
      flex: 1,
      paddingRight: 10,
      flexDirection: "row",
      alignItems: "center",
    },
    itemContent: {
      flex: 1,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    name: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      flexShrink: 1,
    },
    itemIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    qtyBadge: {
      backgroundColor: colors.pill,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    qtyBadgeText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.pillText,
    },
    itemAmount: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    variantText: {
      marginTop: 4,
      fontSize: 12,
      color: colors.textSubtle,
    },
    totalRow: {
      marginTop: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    totalLabel: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },
    totalValue: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },
    paymentMethodRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
    },
    paymentMethodMeta: {
      flex: 1,
    },
    paymentMethodLabel: {
      fontSize: 12,
      color: colors.textSubtle,
      marginBottom: 2,
    },
    paymentMethodValue: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    paymentMethodValueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    changeMethodBtn: {
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    changeMethodText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.text,
    },
    payButton: {
      backgroundColor: colors.text,
      padding: 16,
      width: "100%",
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    payText: {
      color: colors.background,
      fontSize: 16,
      fontWeight: "600",
    },
    payAnimationWrap: {
      width: "100%",
      alignSelf: "center",
      marginTop: 12,
      height: 120,
      alignItems: "center",
      justifyContent: "center",
    },
    payAnimation: {
      width: "100%",
      height: "100%",
    },
    disabled: {
      backgroundColor: colors.textSubtle,
    },
    bottomPanels: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.background,
      paddingTop: 10,
      paddingHorizontal: 2,
    },
    bottomDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
      marginBottom: 8,
    },
    checkoutFooter: {
      backgroundColor: colors.background,
      paddingBottom: 2,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.36)",
      justifyContent: "center",
      padding: 18,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 8,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    methodOption: {
      minHeight: 52,
      backgroundColor: "transparent",
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    methodOptionsCard: {
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderRadius: 10,
      backgroundColor: colors.background,
      overflow: "hidden",
    },
    methodOptionDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    methodOptionSelected: {
      backgroundColor: colors.successSoft,
    },
    methodOptionLeft: {
      flex: 1,
      paddingRight: 10,
    },
    methodOptionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    methodOptionText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    defaultMethodText: {
      marginTop: 2,
      fontSize: 11,
      color: colors.textSubtle,
    },
  });
