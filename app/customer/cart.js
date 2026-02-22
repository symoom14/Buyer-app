import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import AppIcon from "../../src/components/AppIcon";
import ScreenContainer from "../../src/components/ScreenContainer";
import { useCart } from "../../src/context/CartContext";
import { useAppTheme } from "../../src/theme/useAppTheme";

export default function CartPage() {
  const { cart, increment, decrement, removeFromCart } = useCart();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const renderCheckoutFooter = () => (
    <View style={styles.footer}>
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
  );

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
    <ScreenContainer>
      <Text style={styles.title}>Your Cart</Text>

      <FlatList
        data={cart}
        keyExtractor={(item) => item.productId}
        ListEmptyComponent={
          <Text style={styles.empty}>Your cart is empty</Text>
        }
        ListFooterComponent={renderCheckoutFooter}
        renderItem={({ item }) => (
          <Swipeable
            renderRightActions={() => renderRightActions(item.productId)}
          >
            <View style={styles.item}>
              <View style={styles.itemLeft}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.name}</Text>
                </View>
                <View style={styles.priceBadgeRow}>
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceBadgeText}>
                      ${item.price} x {item.quantity} = $
                      {(item.price * item.quantity).toFixed(2)}
                    </Text>
                  </View>
                </View>
                <View style={styles.sellerStoreRow}>
                  <Text style={styles.sellerStoreText}>
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
                  <Text style={styles.sellerStoreText}>
                    {item.storeName || "Unknown store"}
                  </Text>
                </View>
              </View>

              <View style={styles.controls}>
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={() => decrement(item.productId)}
                >
                  <Text style={styles.controlText}>−</Text>
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
          </Swipeable>
        )}
      />
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
  },
  priceBadgeRow: {
    marginTop: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.pill,
    borderRadius: 999,
    paddingHorizontal: 8,
    height: 24,
    alignSelf: "flex-start",
  },
  priceBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.pillText,
  },
  sellerStoreRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sellerStoreText: {
    fontSize: 12,
    color: colors.textSubtle,
    fontWeight: "500",
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
  footer: {
    marginTop: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
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
    width: "80%",
    alignSelf: "center",
    marginTop: 20,
  },
  checkoutText: {
    color: colors.background,
    fontWeight: "600",
  },
  disabled: {
    backgroundColor: colors.textSubtle,
  },
});
