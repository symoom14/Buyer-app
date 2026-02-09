import * as Print from "expo-print";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AppIcon from "../../../src/components/AppIcon";

import { db } from "../../../src/firebase/firebaseConfig";

const STATUS_COLORS = {
  pending: "#FFB300",
  accepted: "#2196F3",
  completed: "#4CAF50",
  cancelled: "#F44336",
};

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function CustomerOrderDetails() {
  const { orderId, merchantId } = useLocalSearchParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const snap = await getDoc(doc(db, "orders", orderId));
    if (snap.exists()) setOrder(snap.data());
  };

  if (!order) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const items = (order.items || []).filter((i) => i.merchantId === merchantId);

  const status = order.merchantStatuses?.[merchantId]?.status || "pending";

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

  const handleDownloadInvoice = async () => {
    try {
      const html = generateInvoiceHTML();
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (err) {
      console.error("Invoice generation failed:", err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order Details</Text>
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: STATUS_COLORS[status] || "#999" },
          ]}
        />
        <Text style={styles.statusText}>
          {STATUS_LABELS[status] || "Pending"}
        </Text>
      </View>
      {status === "cancelled" && (
        <View style={styles.cancelledBox}>
          <AppIcon
            name="information-box"
            variant="community"
            size={28}
            color="#cf0000"
          />
          <Text style={styles.cancelledText}>
            Your order was cancelled. Please contact the seller for more
            details.
          </Text>
        </View>
      )}
      {status === "accepted" && (
        <View style={styles.acceptedBox}>
          <AppIcon
            name="party-popper"
            variant="community"
            size={28}
            color="#02810d"
          />
          <Text style={styles.acceptedText}>
            Woohoo! Your order has been shipped and will be with you shortly!
          </Text>
        </View>
      )}
      <Text style={styles.meta}>
        <Text style={styles.metaLabel}>Order ID: </Text>
        {orderId}
      </Text>
      <Text style={styles.meta}>
        <Text style={styles.metaLabel}>Placed: </Text>
        {order.createdAt?.toDate?.().toLocaleString() || "—"}
      </Text>

      {status === "completed" && (
        <View style={styles.invoiceCard}>
          <Text style={styles.invoiceTitle}>Invoice</Text>
          <Text style={styles.invoiceMeta}>
            Download a PDF invoice for this order.
          </Text>
          <View style={styles.invoiceButton} onTouchEnd={handleDownloadInvoice}>
            <Text style={styles.invoiceButtonText}>Download Invoice (PDF)</Text>
          </View>
        </View>
      )}

      <View style={styles.table}>
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cell, styles.name, styles.headerText]}>
            Item
          </Text>
          <Text style={[styles.cell, styles.qty, styles.headerText]}>Qty</Text>
          <Text style={[styles.cell, styles.price, styles.headerText]}>
            Price
          </Text>
          <Text style={[styles.cell, styles.total, styles.headerText]}>
            Total
          </Text>
        </View>
        {items.map((item, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.cell, styles.name]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.cell, styles.qty]}>{item.quantity}</Text>
            <Text style={[styles.cell, styles.price]}>
              ${item.price.toFixed(2)}
            </Text>
            <Text style={[styles.cell, styles.total]}>
              ${(item.quantity * item.price).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F2F2F7",
  },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 6 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 7,
  },
  statusText: { fontSize: 16, color: "#666", fontWeight: "600" },
  cancelledBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fbc6c6",
    borderWidth: 1,
    borderColor: "#cf0000",
    padding: 10,
    borderRadius: 3,
    marginBottom: 12,
  },
  cancelledText: {
    color: "#cf0000",
    fontWeight: "500",
    fontStyle: "",
    flex: 1,
  },
  acceptedBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#cfffd1",
    borderWidth: 1,
    borderColor: "#00942a",
    padding: 10,
    borderRadius: 3,
    marginBottom: 12,
  },
  acceptedText: {
    color: "#02810d",
    fontWeight: "500",
    fontStyle: "",
    flex: 1,
  },
  meta: { fontSize: 13, color: "#555", marginBottom: 8 },
  metaLabel: { fontWeight: "600" },
  invoiceCard: {
    marginTop: 12,
    marginBottom: 20,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  invoiceTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  invoiceMeta: { fontSize: 12, color: "#666", marginBottom: 10 },
  invoiceButton: {
    backgroundColor: "#000",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  invoiceButtonText: { color: "#fff", fontWeight: "600" },
  table: {
    backgroundColor: "#fff",
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    overflow: "hidden",
  },
  headerRow: {
    backgroundColor: "#F5F5F7",
    borderTopWidth: 0,
  },
  headerText: {
    fontWeight: "600",
    color: "#444",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderColor: "#F0F0F0",
  },
  cell: {
    fontSize: 13,
  },
  name: {
    flex: 2,
    marginRight: 6,
  },
  qty: {
    flex: 1,
    textAlign: "center",
  },
  price: {
    flex: 1,
    textAlign: "right",
  },
  total: {
    flex: 1,
    textAlign: "right",
  },
});
