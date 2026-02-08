import * as Print from "expo-print";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import ScreenContainer from "../../../src/components/ScreenContainer";
import { db } from "../../../src/firebase/firebaseConfig";

export default function InvoicePage() {
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    getDoc(doc(db, "orders", orderId)).then((snap) => setOrder(snap.data()));
  }, []);

  if (!order) return null;

  const html = `
    <h1>Invoice</h1>
    <p>Order ID: ${orderId}</p>
    <ul>
      ${order.items
        .map((i) => `<li>${i.name} × ${i.quantity} — $${i.price}</li>`)
        .join("")}
    </ul>
    <h3>Total: $${order.total}</h3>
  `;

  const handleDownload = async () => {
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 24 }}>Invoice</Text>

      <TouchableOpacity
        style={{ backgroundColor: "#000", padding: 14, borderRadius: 6 }}
        onPress={handleDownload}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>
          View / Download Invoice
        </Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}
