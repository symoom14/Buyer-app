import * as Print from "expo-print";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AppIcon from "../../../src/components/AppIcon";

import { db } from "../../../src/firebase/firebaseConfig";

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_ORDER = ["pending", "accepted", "completed"];
const STATUS_STEP_ICONS = {
  pending: "progress-clock",
  accepted: "account-check",
  completed: "truck-fast",
  cancelled: "close-circle",
};
const STEP_ACTIVE_COLORS = {
  pending: "#FFB300",
  accepted: "#2196F3",
  completed: "#4CAF50",
  cancelled: "#F44336",
};
const STEP_ACTIVE_BACKGROUNDS = {
  pending: "#fff3e0",
  accepted: "#e3f2fd",
  completed: "#e8f5e9",
  cancelled: "#fdecec",
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
  const isCancelled = status === "cancelled";
  const merchantStatus = order.merchantStatuses?.[merchantId] || {};

  const lastPositiveStatus =
    [
      merchantStatus.lastNonCancelledStatus,
      merchantStatus.previousStatus,
      merchantStatus.lastStatus,
      order.lastNonCancelledStatus,
      order.previousStatus,
    ].find((value) => STATUS_ORDER.includes(value)) || "pending";

  const lastPositiveIndex = Math.max(STATUS_ORDER.indexOf(lastPositiveStatus), 0);
  const timelineStatuses = isCancelled
    ? [...STATUS_ORDER.slice(0, lastPositiveIndex + 1), "cancelled"]
    : STATUS_ORDER;

  const currentIndex = isCancelled
    ? timelineStatuses.length - 1
    : STATUS_ORDER.indexOf(status);

  const stepIdleColor = isCancelled ? "#F2B8B5" : "#BDBDBD";
  const lineActiveStyle = { backgroundColor: isCancelled ? "#F44336" : "#4CAF50" };

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

      <View style={styles.timelineContainer}>
        <View style={styles.timeline}>
          {timelineStatuses.map((stepStatus, index) => {
            const isActive = currentIndex >= index;
            const isCurrent = currentIndex === index;
            const stepActiveColor = STEP_ACTIVE_COLORS[stepStatus] || "#4CAF50";
            const stepActiveBackground =
              STEP_ACTIVE_BACKGROUNDS[stepStatus] || "#e8f5e9";

            return (
              <View key={stepStatus} style={styles.timelineStepWrapper}>
                {index > 0 && (
                  <View
                    style={[
                      styles.lineLeft,
                      isActive && styles.lineActive,
                      isActive && lineActiveStyle,
                    ]}
                  />
                )}

                <View style={styles.stepContainer}>
                  <View
                    style={[
                      styles.stepCircle,
                      isActive && styles.stepCircleActive,
                      isCurrent && styles.stepCircleCurrent,
                      isActive && { borderColor: stepActiveColor },
                      isActive && { backgroundColor: stepActiveBackground },
                    ]}
                  >
                    <AppIcon
                      name={STATUS_STEP_ICONS[stepStatus]}
                      variant="community"
                      size={18}
                      color={isActive ? stepActiveColor : stepIdleColor}
                    />
                  </View>

                  <Text
                    style={[
                      styles.stepLabel,
                      isActive && styles.stepLabelActive,
                      isCurrent && styles.stepLabelCurrent,
                      isCurrent && {
                        color: isCancelled ? "#F44336" : stepActiveColor,
                      },
                    ]}
                  >
                    {STATUS_LABELS[stepStatus]}
                  </Text>
                </View>

                {index < timelineStatuses.length - 1 && (
                  <View
                    style={[
                      styles.lineRight,
                      isActive && styles.lineActive,
                      isActive && lineActiveStyle,
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>
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
            name="store-clock"
            variant="community"
            size={24}
            color="#0b5ed7"
          />
          <Text style={styles.acceptedText}>
            Your order has been processed and will be shipped soon!
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
  timelineContainer: {
    marginBottom: 14,
    paddingVertical: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  timeline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  timelineStepWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  lineLeft: {
    flex: 1,
    height: 3,
    backgroundColor: "#ddd",
  },
  lineRight: {
    flex: 1,
    height: 3,
    backgroundColor: "#ddd",
  },
  lineActive: {
    backgroundColor: "#4CAF50",
  },
  stepContainer: {
    alignItems: "center",
    paddingHorizontal: 4,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  stepCircleActive: {
    backgroundColor: "#e8f5e9",
    borderColor: "#4CAF50",
  },
  stepCircleCurrent: {
    backgroundColor: "#e8f5e9",
    borderColor: "#4CAF50",
    borderWidth: 4,
  },
  stepLabel: {
    marginTop: 8,
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    fontWeight: "500",
  },
  stepLabelActive: {
    color: "#333",
    fontWeight: "600",
  },
  stepLabelCurrent: {
    color: "#2196F3",
    fontWeight: "700",
  },
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
    backgroundColor: "#cce0ff",
    borderWidth: 1,
    borderColor: "#0b5ed7",
    padding: 8,
    borderRadius: 3,
    marginBottom: 10,
  },
  acceptedText: {
    color: "#0b5ed7",
    fontWeight: "500",
    fontSize: 13,
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
