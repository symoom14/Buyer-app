import { useRouter } from "expo-router";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import ScreenContainer from "../../src/components/ScreenContainer";
import { useCart } from "../../src/context/CartContext";

export default function CartPage() {
  const { cart, increment, decrement, removeFromCart } = useCart();
  const router = useRouter();

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const renderRightActions = (productId) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => removeFromCart(productId)}
    >
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
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
        renderItem={({ item }) => (
          <Swipeable
            renderRightActions={() => renderRightActions(item.productId)}
          >
            <View style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.subtotal}>
                  ${item.price} × {item.quantity} = $
                  {(item.price * item.quantity).toFixed(2)}
                </Text>
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

      <View style={styles.footer}>
        <Text style={styles.total}>Total: ${total.toFixed(2)}</Text>

        <TouchableOpacity
          style={[styles.checkoutBtn, cart.length === 0 && styles.disabled]}
          disabled={cart.length === 0}
          onPress={() => router.push("/customer/checkout")}
        >
          <Text style={styles.checkoutText}>Checkout</Text>
        </TouchableOpacity>
      </View>
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
  name: {
    fontWeight: "600",
    marginBottom: 4,
  },
  subtotal: {
    color: "#555",
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
  deleteButton: {
    backgroundColor: "#d32f2f",
    justifyContent: "center",
    alignItems: "center",
    width: 90,
    borderRadius: 8,
    marginBottom: 12,
  },
  deleteText: {
    color: "#fff",
    fontWeight: "600",
  },
  footer: {
    marginTop: 12,
  },
  total: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  checkoutBtn: {
    backgroundColor: "#000",
    padding: 14,
    borderRadius: 6,
    alignItems: "center",
  },
  checkoutText: {
    color: "#fff",
    fontWeight: "600",
  },
  disabled: {
    backgroundColor: "#999",
  },
});
