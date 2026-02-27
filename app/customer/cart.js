import { useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "../../src/components/AppIcon";
import ScreenContainer from "../../src/components/ScreenContainer";
import { useCart } from "../../src/context/CartContext";
import { db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const ICON_COLOR_POOL = [
  "#E53935",
  "#2E7D32",
  "#1E88E5",
  "#FFA700",
  "#F57C00",
];

export default function CartPage() {
  const insets = useSafeAreaInsets();
  const { cart, increment, decrement, removeFromCart } = useCart();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [productVisualsById, setProductVisualsById] = useState({});

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const getRandomIconColor = useCallback(() => {
    const idx = Math.floor(Math.random() * ICON_COLOR_POOL.length);
    return ICON_COLOR_POOL[idx];
  }, []);

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
          };
        });
        setProductVisualsById(visuals);
      } catch (error) {
        console.error("Failed to load product visuals for cart:", error);
      }
    };

    loadProductVisuals();
  }, [getRandomIconColor]);

  const renderRightActions = (productId) => (
    <View style={styles.deleteActionWrap}>
      <TouchableOpacity
        style={styles.deleteActionButton}
        onPress={() => removeFromCart(productId)}
      >
        <AppIcon
          name="basket-remove-outline"
          variant="community"
          size={24}
          color={colors.danger}
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <ScreenContainer disableBottomInset bottomPadding={0}>
      <Text style={styles.title}>Your Cart</Text>

      <View style={styles.contentWrap}>
        <FlatList
          data={cart}
          keyExtractor={(item) => item.productId}
          ListEmptyComponent={<Text style={styles.empty}>Your cart is empty</Text>}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 170,
          }}
          renderItem={({ item }) => (
            <Swipeable renderRightActions={() => renderRightActions(item.productId)}>
              <View style={styles.item}>
                <View style={styles.itemLeft}>
                  <View style={styles.nameRow}>
                    <View style={styles.itemIconWrap}>
                      <AppIcon
                        name={
                          item.iconName ||
                          productVisualsById[item.productId]?.iconName ||
                          DEFAULT_PRODUCT_ICON
                        }
                        variant="community"
                        size={18}
                        color={productVisualsById[item.productId]?.iconColor || colors.text}
                      />
                    </View>
                    <Text style={styles.name}>{item.name}</Text>
                  </View>
                  <View style={styles.sellerStoreRow}>
                    <Text
                      style={[styles.sellerStoreText, styles.sellerText]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.merchantName || "Unknown seller"}
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
                      {item.storeName || "Unknown store"}
                    </Text>
                  </View>

                  <View style={styles.controls}>
                    <TouchableOpacity
                      style={styles.controlBtn}
                      onPress={() => decrement(item.productId)}
                    >
                      <Text style={styles.controlText}>-</Text>
                    </TouchableOpacity>

                    <Text style={styles.qty}>{item.quantity}</Text>

                    <TouchableOpacity
                      style={styles.controlBtn}
                      onPress={() => increment(item.productId)}
                    >
                      <Text style={styles.controlText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.itemRight}>
                  <Text style={styles.itemTotal}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              </View>
            </Swipeable>
          )}
        />

        <View
          style={[
            styles.checkoutFooter,
            { paddingBottom: insets.bottom },
          ]}
        >
          <View style={styles.summaryRow}>
            <Text style={styles.itemCount}>
              {totalItems} {totalItems === 1 ? "item" : "items"}
            </Text>
            <Text style={styles.total}>${total.toFixed(2)}</Text>
          </View>

          <TouchableOpacity
            style={[styles.checkoutBtn, cart.length === 0 && styles.disabled]}
            disabled={cart.length === 0}
            onPress={() => router.push("/customer/checkout")}
          >
            <AppIcon
              name="arrow-right-thick"
              variant="community"
              size={20}
              color={colors.background}
            />
            <Text style={styles.checkoutText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    empty: {
      color: colors.textSubtle,
      marginTop: 20,
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
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    deleteActionWrap: {
      justifyContent: "center",
      alignItems: "center",
      width: 84,
      marginBottom: 12,
    },
    deleteActionButton: {
      backgroundColor: colors.surfaceMuted,
      justifyContent: "center",
      alignItems: "center",
      width: 52,
      height: 52,
      borderRadius: 26,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    itemCount: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.textMuted,
    },
    total: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },
    checkoutBtn: {
      backgroundColor: colors.text,
      padding: 14,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      width: "100%",
    },
    checkoutText: {
      color: colors.background,
      fontWeight: "600",
    },
    disabled: {
      backgroundColor: colors.textSubtle,
    },
    checkoutFooter: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
      paddingTop: 12,
    },
  });
