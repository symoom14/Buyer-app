import * as Print from "expo-print";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity } from "react-native";
import ScreenContainer from "../../../src/components/ScreenContainer";
import { db } from "../../../src/firebase/firebaseConfig";

export default function InvoicePage() {
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, []);

  const fetchOrder = async () => {
    try {
      const snap = await getDoc(doc(db, "orders", orderId));
      if (snap.exists()) {
        setOrder(snap.data());
      }
    } catch (err) {
      console.error("Failed to fetch order:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateInvoiceHTML = () => {
    if (!order || !order.items) {
      throw new Error("Invoice data not ready");
    }

    const now = new Date().toLocaleString();

    const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);

    const rows = order.items
      .map(
        (item) => `
          <tr>
            <td>${item.name}</td>
            <td>${item.merchantName || "—"}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">$${item.price.toFixed(2)}</td>
            <td style="text-align:right;">$${(
              item.price * item.quantity
            ).toFixed(2)}</td>
          </tr>
        `,
      )
      .join("");

    return `
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              padding: 24px;
              color: #000;
            }
            h1 { font-size: 28px; margin-bottom: 4px; }
            h2 { font-size: 20px; margin-bottom: 24px; }
            .meta b { display: inline-block; width: 120px; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 16px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              font-size: 14px;
            }
            th { background-color: #f5f5f5; }
            .summary td { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Buyer</h1>
          <h2>Tax Invoice</h2>

          <div class="meta">
            <p><b>Order ID:</b> ${orderId}</p>
            <p><b>Date/Time:</b> ${now}</p>
            <p><b>Payment method:</b> Credit card ending 1234</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Merchant</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Unit price</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="summary">
                <td colspan="2">Totals</td>
                <td style="text-align:center;">${totalItems}</td>
                <td></td>
                <td style="text-align:right;">$${order.total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
  };

  const handleDownload = async () => {
    try {
      const html = generateInvoiceHTML();
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (err) {
      console.error("Invoice generation failed:", err.message);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size="large" />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer>
        <Text>Invoice not available yet.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 12 }}>
        Invoice
      </Text>

      <TouchableOpacity
        style={{
          backgroundColor: "#000",
          padding: 14,
          borderRadius: 6,
          alignItems: "center",
        }}
        onPress={handleDownload}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>
          Download Invoice (PDF)
        </Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}
