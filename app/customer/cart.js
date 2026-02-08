import { useRouter } from "expo-router";
import { FlatList, Text, TouchableOpacity } from "react-native";
import ScreenContainer from "../../src/components/ScreenContainer";
import { useCart } from "../../src/context/CartContext";

export default function CartPage() {
  const { cart } = useCart();
  const router = useRouter();

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 24, fontWeight: "600" }}>Cart</Text>

      <FlatList
        data={cart}
        keyExtractor={(item) => item.productId}
        renderItem={({ item }) => (
          <Text>
            {item.name} × {item.quantity} — ${item.price}
          </Text>
        )}
      />

      <Text style={{ marginVertical: 12 }}>Total: ${total}</Text>

      <TouchableOpacity
        style={{ backgroundColor: "#000", padding: 14, borderRadius: 6 }}
        onPress={() => router.push("/customer/checkout")}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>Checkout</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}
