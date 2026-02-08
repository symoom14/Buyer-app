import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCart } from "../context/CartContext";

export default function FloatingCartButton() {
  const router = useRouter();
  const { cart } = useCart();

  if (cart.length === 0) return null;

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["bottom", "right"]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/customer/cart")}
      >
        <Text style={styles.text}>Cart ({cart.length})</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: "absolute",
    right: 0,
    bottom: 0,
    pointerEvents: "box-none",
  },
  button: {
    marginRight: 16,
    marginBottom: 24,
    backgroundColor: "#000",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  text: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
