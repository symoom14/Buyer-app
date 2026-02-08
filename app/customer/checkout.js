import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Text, TouchableOpacity } from "react-native";
import ScreenContainer from "../../src/components/ScreenContainer";
import { useCart } from "../../src/context/CartContext";
import { auth, db } from "../../src/firebase/firebaseConfig";

export default function Checkout() {
  const { cart, clearCart } = useCart();
  const router = useRouter();

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handlePay = async () => {
    const orderRef = await addDoc(collection(db, "orders"), {
      customerId: auth.currentUser.uid,
      items: cart,
      total,
      status: "paid",
      createdAt: serverTimestamp(),
    });

    clearCart();
    router.replace(`/customer/invoice/${orderRef.id}`);
  };

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 24 }}>Payment</Text>

      <TouchableOpacity
        style={{ backgroundColor: "#000", padding: 14, borderRadius: 6 }}
        onPress={handlePay}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>Pay ${total}</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}
