import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ScreenContainer from "../../src/components/ScreenContainer";
import { useCart } from "../../src/context/CartContext";
import { auth, db } from "../../src/firebase/firebaseConfig";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, clearCart } = useCart();

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handlePay = async () => {
    try {
      if (!cart.length) {
        throw new Error("Cart is empty");
      }

      const orderRef = await addDoc(collection(db, "orders"), {
        customerId: auth.currentUser.uid,
        items: cart.map((item) => ({
          productId: item.productId,
          name: item.name,
          merchantId: item.merchantId,
          merchantName: item.merchantName,
          quantity: Number(item.quantity),
          price: Number(item.price),
        })),
        total: Number(total),
        paymentMethod: "Credit card ending 1234",
        createdAt: serverTimestamp(),
      });

      clearCart();
      router.replace(`/customer/invoice/${orderRef.id}`);
    } catch (err) {
      console.error("Checkout failed:", err.message);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Checkout</Text>

      {cart.map((item) => (
        <View key={item.productId} style={styles.row}>
          <Text style={styles.name}>
            {item.name} × {item.quantity}
          </Text>
          <Text>${(item.price * item.quantity).toFixed(2)}</Text>
        </View>
      ))}

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
      </View>

      <TouchableOpacity
        style={[styles.payButton, cart.length === 0 && styles.disabled]}
        disabled={cart.length === 0}
        onPress={handlePay}
      >
        <Text style={styles.payText}>Pay ${total.toFixed(2)}</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  name: {
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  payButton: {
    backgroundColor: "#000",
    padding: 16,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 20,
  },
  payText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  disabled: {
    backgroundColor: "#999",
  },
});
