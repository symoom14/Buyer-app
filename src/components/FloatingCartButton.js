import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useCart } from "../context/CartContext";

export default function FloatingCartButton() {
  const { cart } = useCart();
  const router = useRouter();

  if (cart.length === 0) return null;

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => router.push("/customer/cart")}
    >
      <Text style={styles.text}>🛒 {cart.length}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: "#000",
    padding: 14,
    borderRadius: 28,
  },
  text: {
    color: "#fff",
    fontWeight: "600",
  },
});
