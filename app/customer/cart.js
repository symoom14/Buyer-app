import { useRouter } from "expo-router";
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

export default function CartPage() {
  const { cart, increment, decrement, removeFromCart } = useCart();
  const router = useRouter();

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
          color="#fff"
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
          color="#C62828"
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
                      color="#5C5C5C"
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
                  <Text>−</Text>
                </TouchableOpacity>

                <Text style={styles.qty}>{item.quantity}</Text>

                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={() => increment(item.productId)}
                >
                  <Text>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Swipeable>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  empty: {
    color: "#666",
    marginTop: 20,
  },
  item: {
    flexDirection: "row",
    padding: 14,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#fff",
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
    color: "#1F1F1F",
  },
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E7F1FF",
    borderRadius: 999,
    paddingHorizontal: 8,
    height: 24,
    alignSelf: "flex-start",
  },
  priceBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1F5FBF",
  },
  sellerStoreRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sellerStoreText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  arrowChip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
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
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  qty: {
    minWidth: 20,
    textAlign: "center",
  },
  deleteActionWrap: {
    justifyContent: "center",
    alignItems: "center",
    width: 84,
    marginBottom: 12,
  },
  deleteActionButton: {
    backgroundColor: "#FFE0E6",
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
    color: "#555",
  },
  total: {
    fontSize: 18,
    fontWeight: "600",
  },
  checkoutBtn: {
    backgroundColor: "#000",
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
    color: "#fff",
    fontWeight: "600",
  },
  disabled: {
    backgroundColor: "#999",
  },
});
