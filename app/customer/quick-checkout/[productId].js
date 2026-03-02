import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import LottieView from "lottie-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "../../../src/components/AppIcon";
import ScreenContainer from "../../../src/components/ScreenContainer";
import {
  DEFAULT_PAYMENT_METHOD_ID,
  PAYMENT_METHOD_PRESETS,
  normalizePaymentMethod,
} from "../../../src/constants/paymentMethods";
import { getSelectedVariantIconColor } from "../../../src/constants/variantColorMap";
import { auth, db } from "../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../src/theme/useAppTheme";
import { notifyMerchantNewOrder } from "../../../src/utils/notifications";
import {
  findMatchingVariant,
  formatSelectedOptionsLabel,
  normalizeVariantGroups,
  resolveVariantUnitPrice,
  resolveSelectedOptions,
} from "../../../src/utils/productVariants";
import { getUserDisplayName } from "../../../src/utils/userDisplayName";

const QUICK_CHECKOUT_FIXED_AREA_HEIGHT = 236;
const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const ICON_COLOR_POOL = [
  "#E53935",
  "#2E7D32",
  "#1E88E5",
  "#FFA700",
  "#F57C00",
];

export default function QuickCheckoutPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { productId, selectedOptions } = useLocalSearchParams();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isPaying, setIsPaying] = useState(false);
  const [animationCompleted, setAnimationCompleted] = useState(false);
  const [pendingInvoiceId, setPendingInvoiceId] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [defaultPaymentMethodId, setDefaultPaymentMethodId] = useState("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [paymentPickerVisible, setPaymentPickerVisible] = useState(false);
  const incomingSelectedOptions = useMemo(() => {
    const raw = Array.isArray(selectedOptions) ? selectedOptions[0] : selectedOptions;
    if (!raw) return {};
    try {
      const parsed = JSON.parse(String(raw));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }, [selectedOptions]);

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

  const variantGroups = useMemo(
    () => normalizeVariantGroups(product?.variantGroups),
    [product?.variantGroups],
  );
  const resolvedSelectedOptions = useMemo(
    () => resolveSelectedOptions(incomingSelectedOptions, variantGroups),
    [incomingSelectedOptions, variantGroups],
  );
  const selectedVariant = useMemo(
    () => findMatchingVariant(product?.variants, resolvedSelectedOptions),
    [product?.variants, resolvedSelectedOptions],
  );
  const unitPrice = useMemo(
    () =>
      Number(
        resolveVariantUnitPrice(
          product?.price || 0,
          product?.variants,
          resolvedSelectedOptions,
        ),
      ),
    [product?.price, product?.variants, resolvedSelectedOptions],
  );
  const total = unitPrice * quantity;
  const selectedOptionsLabel = useMemo(
    () => formatSelectedOptionsLabel(resolvedSelectedOptions, variantGroups),
    [resolvedSelectedOptions, variantGroups],
  );
  const selectedVariantIconColor = useMemo(
    () => getSelectedVariantIconColor(resolvedSelectedOptions),
    [resolvedSelectedOptions],
  );

  useEffect(() => {
    if (!animationCompleted || !pendingInvoiceId) return;
    router.replace(`/customer/invoice/${pendingInvoiceId}`);
  }, [animationCompleted, pendingInvoiceId, router]);

  useEffect(() => {
    const loadCheckoutProduct = async () => {
      try {
        setLoading(true);
        const targetProductId = String(productId || "");
        if (!targetProductId) {
          setProduct(null);
          return;
        }

        const productSnap = await getDoc(doc(db, "products", targetProductId));
        if (!productSnap.exists()) {
          setProduct(null);
          return;
        }

        const productData = productSnap.data() || {};
        const merchantId =
          productData.merchantId || productData.sellerId || productData.userId || "";
        let storeName = "Unknown Store";
        let resolvedMerchantId = merchantId;
        let merchantName = "Unknown Seller";

        if (productData.storeId) {
          const storeSnap = await getDoc(doc(db, "stores", productData.storeId));
          if (storeSnap.exists()) {
            const storeData = storeSnap.data() || {};
            storeName = storeData.name || storeName;
            resolvedMerchantId = resolvedMerchantId || storeData.merchantId || "";
          }
        }

        if (resolvedMerchantId) {
          const merchantSnap = await getDoc(doc(db, "users", resolvedMerchantId));
          if (merchantSnap.exists()) {
            merchantName = getUserDisplayName(merchantSnap.data(), "Unknown Seller");
          }
        }

        const idText = String(targetProductId);
        const colorIndex =
          idText.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) %
          ICON_COLOR_POOL.length;

        setProduct({
          id: targetProductId,
          name: productData.name || "Product",
          price: Number(productData.price || 0),
          iconName: productData.iconName || productData.icon || DEFAULT_PRODUCT_ICON,
          variantGroups: normalizeVariantGroups(productData.variantGroups),
          variants: Array.isArray(productData.variants) ? productData.variants : [],
          iconColor: ICON_COLOR_POOL[colorIndex],
          storeId: productData.storeId,
          storeName,
          merchantId: resolvedMerchantId || "unknown",
          merchantName,
        });
      } catch (error) {
        console.error("Failed to load quick checkout product:", error);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    loadCheckoutProduct();
  }, [productId]);

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

  const handlePay = async () => {
    try {
      if (!product) {
        throw new Error("No product selected");
      }
      if (!effectivePaymentMethod) {
        throw new Error("No payment method available");
      }
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) {
        throw new Error("Not signed in");
      }

      setIsPaying(true);
      setAnimationCompleted(false);
      setPendingInvoiceId(null);

      const orderRef = await addDoc(collection(db, "orders"), {
        customerId: currentUserId,
        items: [
          {
            productId: product.id,
            name: product.name,
            storeId: product.storeId || "",
            storeName: product.storeName || "",
            merchantId: product.merchantId,
            merchantName: product.merchantName,
            iconName: product.iconName || DEFAULT_PRODUCT_ICON,
            selectedVariantId: selectedVariant?.id || null,
            quantity: Number(quantity),
            price: Number(unitPrice),
            selectedOptions: resolvedSelectedOptions,
            selectedOptionsLabel,
          },
        ],
        total: Number(total),
        paymentMethod: effectivePaymentMethod.label,
        paymentMethodId: effectivePaymentMethod.id,
        createdAt: serverTimestamp(),
      });

      if (product.merchantId && product.merchantId !== "unknown") {
        await notifyMerchantNewOrder({
          merchantId: product.merchantId,
          orderId: orderRef.id,
        });
      }

      setPendingInvoiceId(orderRef.id);
    } catch (error) {
      console.error("Quick checkout failed:", error.message);
      setIsPaying(false);
      setAnimationCompleted(false);
      setPendingInvoiceId(null);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer disableBottomInset bottomPadding={0}>
      <Text style={styles.title}>Quick checkout</Text>

      <View style={styles.contentWrap}>
        <ScrollView
          style={styles.itemsScroll}
          contentContainerStyle={[
            styles.itemsScrollContent,
            {
              paddingBottom: insets.bottom + QUICK_CHECKOUT_FIXED_AREA_HEIGHT,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.itemsCard}>
            {product ? (
              <View style={styles.item}>
                <View style={styles.itemLeft}>
                  <View style={styles.nameRow}>
                    <View style={styles.itemIconWrap}>
                      <AppIcon
                        name={product.iconName || DEFAULT_PRODUCT_ICON}
                        variant="community"
                        size={18}
                        color={selectedVariantIconColor || product.iconColor || colors.text}
                      />
                    </View>
                    <Text style={styles.name}>{product.name}</Text>
                  </View>
                  {selectedOptionsLabel ? (
                    <Text style={styles.variantText} numberOfLines={1}>
                      {selectedOptionsLabel}
                    </Text>
                  ) : null}
                  <View style={styles.sellerStoreRow}>
                    <Text
                      style={[styles.sellerStoreText, styles.sellerText]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {product.merchantName || "Unknown seller"}
                    </Text>
                    <View style={styles.arrowChip}>
                      <AppIcon
                        name="chevron-right"
                        variant="community"
                        size={14}
                        color={colors.textMuted}
                      />
                    </View>
                    <Text
                      style={[styles.sellerStoreText, styles.storeText]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {product.storeName || "Unknown store"}
                    </Text>
                  </View>
                  <View style={styles.controls}>
                    <TouchableOpacity
                      style={styles.controlBtn}
                      onPress={() => setQuantity((prev) => Math.max(1, prev - 1))}
                      disabled={isPaying}
                    >
                      <Text style={styles.controlText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qty}>{quantity}</Text>
                    <TouchableOpacity
                      style={styles.controlBtn}
                      onPress={() => setQuantity((prev) => prev + 1)}
                      disabled={isPaying}
                    >
                      <Text style={styles.controlText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemTotal}>${total.toFixed(2)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyStateWrap}>
                <Text style={styles.emptyStateText}>Product not found.</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.bottomPanels, { paddingBottom: insets.bottom }]}>
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
                  source={require("../../../assets/lottie/loading tick.json")}
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
                  (!product || !effectivePaymentMethod) && styles.disabled,
                ]}
                disabled={!product || !effectivePaymentMethod}
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
    loadingWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
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
      backgroundColor: "transparent",
    },
    item: {
      flexDirection: "row",
      padding: 14,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderRadius: 8,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    itemLeft: {
      flex: 1,
      paddingRight: 10,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    itemIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    name: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
    },
    sellerStoreRow: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    variantText: {
      marginTop: 4,
      fontSize: 12,
      color: colors.textSubtle,
    },
    sellerStoreText: {
      fontSize: 12,
      color: colors.textSubtle,
      fontWeight: "500",
    },
    sellerText: {
      maxWidth: "44%",
    },
    storeText: {
      maxWidth: "44%",
    },
    arrowChip: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.screen,
      alignItems: "center",
      justifyContent: "center",
    },
    controls: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    controlBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    controlText: {
      color: colors.text,
    },
    qty: {
      minWidth: 20,
      textAlign: "center",
      color: colors.text,
    },
    itemRight: {
      minWidth: 86,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    itemTotal: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    emptyStateWrap: {
      paddingVertical: 28,
      paddingHorizontal: 16,
    },
    emptyStateText: {
      fontSize: 14,
      color: colors.textSubtle,
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
    paymentMethodValueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    paymentMethodValue: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
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
    totalRow: {
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
    disabled: {
      backgroundColor: colors.textSubtle,
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
    methodOptionsCard: {
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderRadius: 10,
      backgroundColor: colors.background,
      overflow: "hidden",
    },
    methodOption: {
      minHeight: 52,
      backgroundColor: "transparent",
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
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
