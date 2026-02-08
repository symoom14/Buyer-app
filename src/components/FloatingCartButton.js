import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useCart } from "../context/CartContext";

export default function FloatingCartButton() {
  const { cart } = useCart();
  const router = useRouter();

  if (cart.length === 0) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/customer/cart")}
      >
        <Text style={styles.text}> Cart ({cart.length})</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 16,
    bottom: 32,
  },
  button: {
    backgroundColor: "#000",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    elevation: 5,
  },
  text: {
    color: "#fff",
    fontWeight: "600",
  },
});
