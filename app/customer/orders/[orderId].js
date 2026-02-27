import * as Print from "expo-print";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AppIcon from "../../../src/components/AppIcon";
import PdfViewer from "../../../src/components/PdfViewer";

import { auth, db } from "../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../src/theme/useAppTheme";
import {
  notifyCustomerOrderCancelled,
  notifyMerchantOrderCancelledByCustomer,
  notifyMerchantRefundRequest,
} from "../../../src/utils/notifications";

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
  completed: "truck-check",
  cancelled: "close-circle",
};
const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const ICON_COLOR_POOL = ["#E53935", "#2E7D32", "#1E88E5", "#FFA700", "#F57C00"];
const ESTIMATED_DELIVERY_OPTIONS = [
  "Today",
  "Tomorrow",
  "In a week",
  "In two weeks",
];

function toHexChannel(value) {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, "0");
}

function getLightIconBackground(iconColor, fallbackColor) {
  if (typeof iconColor !== "string" || !iconColor.startsWith("#")) {
    return fallbackColor;
  }
  const fullHex = iconColor.slice(1);
  if (fullHex.length !== 6) return fallbackColor;

  const r = parseInt(fullHex.slice(0, 2), 16);
  const g = parseInt(fullHex.slice(2, 4), 16);
  const b = parseInt(fullHex.slice(4, 6), 16);

  const mix = 0.8;
  const bgR = r + (255 - r) * mix;
  const bgG = g + (255 - g) * mix;
  const bgB = b + (255 - b) * mix;

  return `#${toHexChannel(bgR)}${toHexChannel(bgG)}${toHexChannel(bgB)}`;
}

function pickPaletteColor(seedValue) {
  const raw = String(seedValue || "");
  if (!raw) return ICON_COLOR_POOL[0];
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return ICON_COLOR_POOL[Math.abs(hash) % ICON_COLOR_POOL.length];
}

function getEstimatedDelivery(seedValue) {
  const raw = String(seedValue || "");
  if (!raw) return ESTIMATED_DELIVERY_OPTIONS[0];
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % ESTIMATED_DELIVERY_OPTIONS.length;
  return ESTIMATED_DELIVERY_OPTIONS[idx];
}

function formatArrivingLabel(slot) {
  if (slot === "Today") return "Arriving today";
  if (slot === "Tomorrow") return "Arriving tomorrow";
  if (slot === "In a week") return "Arriving next week";
  if (slot === "In two weeks") return "Arriving in two weeks";
  return "Arriving soon";
}

export default function CustomerOrderDetails() {
  const { orderId, merchantId } = useLocalSearchParams();
  const { colors, isDark } = useAppTheme();
  const [order, setOrder] = useState(null);
  const [invoiceUri, setInvoiceUri] = useState("");
  const [viewerVisible, setViewerVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState("");
  const [requestingRefund, setRequestingRefund] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const stepActiveColors = useMemo(
    () => ({
      pending: isDark ? colors.warning : "#FFB300",
      accepted: isDark ? "#4DA3FF" : "#2196F3",
      completed: isDark ? colors.success : "#4CAF50",
      cancelled: colors.danger,
    }),
    [colors.danger, colors.success, colors.warning, isDark],
  );
  const stepActiveBackgrounds = useMemo(
    () => ({
      pending: isDark ? colors.surfaceMuted : "#fff3e0",
      accepted: isDark ? colors.surfaceMuted : "#e3f2fd",
      completed: isDark ? colors.successSoft : "#e8f5e9",
      cancelled: isDark ? colors.surfaceMuted : "#fdecec",
    }),
    [colors, isDark],
  );

  const load = useCallback(async () => {
    const [orderSnap, productsSnap] = await Promise.all([
      getDoc(doc(db, "orders", orderId)),
      getDocs(collection(db, "products")),
    ]);

    if (!orderSnap.exists()) {
      setOrder(null);
      return;
    }

    const productIconById = {};
    productsSnap.docs.forEach((productDoc) => {
      const data = productDoc.data();
      productIconById[String(productDoc.id)] =
        data?.iconName || data?.icon || DEFAULT_PRODUCT_ICON;
    });

    const orderData = orderSnap.data();
    const enrichedItems = (orderData.items || []).map((item) => ({
      ...item,
      iconName:
        item.iconName ||
        item.icon ||
        productIconById[String(item.productId)] ||
        DEFAULT_PRODUCT_ICON,
    }));

    setOrder({
      ...orderData,
      items: enrichedItems,
    });
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!order) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const items = (order.items || []).filter((i) => i.merchantId === merchantId);
  const scopedMerchantId = merchantId || items?.[0]?.merchantId || "";

  const status = order.merchantStatuses?.[scopedMerchantId]?.status || "pending";
  const refundState = order.merchantRefunds?.[scopedMerchantId] || null;
  const refundStatus = refundState?.status || null;
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

  const lastPositiveIndex = Math.max(
    STATUS_ORDER.indexOf(lastPositiveStatus),
    0,
  );
  const timelineStatuses = isCancelled
    ? [...STATUS_ORDER.slice(0, lastPositiveIndex + 1), "cancelled"]
    : STATUS_ORDER;

  const currentIndex = isCancelled
    ? timelineStatuses.length - 1
    : STATUS_ORDER.indexOf(status);
  const arrivingLabel =
    status === "pending" || status === "accepted"
      ? formatArrivingLabel(
          getEstimatedDelivery(`${orderId}:${scopedMerchantId}`),
        )
      : "";

  const stepIdleColor = isCancelled
    ? isDark
      ? colors.danger
      : "#F2B8B5"
    : colors.textSubtle;
  const lineActiveStyle = {
    backgroundColor: isCancelled ? colors.danger : colors.success,
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
            <p><b>Payment method:</b> ${order.paymentMethod || "Card ending 1234"}</p>
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

  const getInvoiceUri = async () => {
    if (invoiceUri) return invoiceUri;
    const html = generateInvoiceHTML();
    const { uri } = await Print.printToFileAsync({ html });
    setInvoiceUri(uri);
    return uri;
  };

  const handleViewInvoice = async () => {
    try {
      const uri = await getInvoiceUri();
      setPreviewUri(uri);
      setViewerVisible(true);
    } catch (err) {
      console.error("Invoice preview failed:", err.message);
    }
  };

  const handleDownloadInvoice = async () => {
    try {
      const uri = await getInvoiceUri();
      await Sharing.shareAsync(uri);
    } catch (err) {
      console.error("Invoice generation failed:", err.message);
    }
  };

  const placedAt = order.createdAt?.toDate?.().toLocaleString() || "—";
  const merchantName = items[0]?.merchantName || "Store";
  const merchantRefundAmount = items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0,
  );
  const canRequestRefund =
    (status === "accepted" || status === "completed") &&
    refundStatus !== "requested" &&
    refundStatus !== "processed";
  const canCancelPendingOrder = status === "pending" && !cancellingOrder;

  const handleRequestRefund = async () => {
    if (!canRequestRefund || requestingRefund) return;

    Alert.alert(
      "Request refund",
      "Send a refund request to the merchant for this order?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send request",
          style: "default",
          onPress: async () => {
            try {
              setRequestingRefund(true);
              await updateDoc(doc(db, "orders", orderId), {
                [`merchantRefunds.${scopedMerchantId}`]: {
                  status: "requested",
                  amount: Number(merchantRefundAmount || 0),
                  requestedAt: new Date(),
                },
              });

              await notifyMerchantRefundRequest({
                merchantId: scopedMerchantId,
                orderId,
                customerId: auth.currentUser?.uid,
              });

              setOrder((prev) => ({
                ...prev,
                merchantRefunds: {
                  ...(prev?.merchantRefunds || {}),
                  [scopedMerchantId]: {
                    status: "requested",
                    amount: Number(merchantRefundAmount || 0),
                    requestedAt: new Date(),
                  },
                },
              }));
            } catch (error) {
              console.error("Failed to request refund:", error);
            } finally {
              setRequestingRefund(false);
            }
          },
        },
      ],
    );
  };

  const handleCancelPendingOrder = () => {
    if (!canCancelPendingOrder || !scopedMerchantId) return;

    Alert.alert("Cancel order", "Are you sure you want to cancel this order?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel order",
        style: "destructive",
        onPress: async () => {
          try {
            setCancellingOrder(true);
            await updateDoc(doc(db, "orders", orderId), {
              status: "cancelled",
              statusUpdatedAt: new Date(),
              [`merchantStatuses.${scopedMerchantId}`]: {
                status: "cancelled",
                statusUpdatedAt: new Date(),
              },
            });

            await Promise.all([
              notifyMerchantOrderCancelledByCustomer({
                merchantId: scopedMerchantId,
                orderId,
                customerId: auth.currentUser?.uid,
              }),
              notifyCustomerOrderCancelled({
                customerId: order.customerId || auth.currentUser?.uid,
                orderId,
                merchantId: scopedMerchantId,
              }),
            ]);

            setOrder((prev) => ({
              ...prev,
              status: "cancelled",
              statusUpdatedAt: new Date(),
              merchantStatuses: {
                ...(prev?.merchantStatuses || {}),
                [scopedMerchantId]: {
                  ...(prev?.merchantStatuses?.[scopedMerchantId] || {}),
                  status: "cancelled",
                  statusUpdatedAt: new Date(),
                },
              },
            }));
          } catch (error) {
            console.error("Failed to cancel order:", error);
          } finally {
            setCancellingOrder(false);
          }
        },
      },
    ]);
  };

  const renderRefundContent = () => {
    if (refundStatus === "processed") {
      return (
        <Text style={styles.refundSuccessText}>
          Refund confirmed. The merchant has processed your refund.
        </Text>
      );
    }

    if (refundStatus === "requested") {
      return (
        <Text style={styles.refundPendingText}>
          Refund requested. Waiting for merchant action.
        </Text>
      );
    }

    return (
      <View>
        <Text style={styles.refundMetaText}>
          The merchant will review your request for a refund before processing.
        </Text>
        <TouchableOpacity
          style={[
            styles.refundButton,
            requestingRefund && styles.refundButtonDisabled,
          ]}
          onPress={handleRequestRefund}
          disabled={requestingRefund}
        >
          <AppIcon
            name="cash-refund"
            variant="community"
            size={14}
            color={colors.background}
          />
          <Text style={styles.refundButtonText}>
            {requestingRefund ? "Sending..." : "Request Refund"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <PdfViewer
        visible={viewerVisible}
        uri={previewUri}
        onClose={() => setViewerVisible(false)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Order Details</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Order</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              #{orderId}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Seller</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {merchantName}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Placed</Text>
            <Text style={styles.summaryValue}>{placedAt}</Text>
          </View>
        </View>

        <View style={styles.timelineContainer}>
          <View style={styles.timeline}>
            {timelineStatuses.map((stepStatus, index) => {
              const isActive = currentIndex >= index;
              const isCurrent = currentIndex === index;
              const stepActiveColor =
                stepActiveColors[stepStatus] || colors.success;
              const stepActiveBackground =
                stepActiveBackgrounds[stepStatus] ||
                (isDark ? colors.successSoft : "#e8f5e9");

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
                          color: isCancelled ? colors.danger : stepActiveColor,
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
              color={isDark ? colors.danger : "#cf0000"}
            />
            <Text style={styles.cancelledText}>
              Your order was cancelled. Please contact the seller for more
              details.
            </Text>
          </View>
        )}
        {(status === "pending" || status === "accepted") && (
          <View style={styles.acceptedBox}>
            <AppIcon
              name={status === "accepted" ? "truck-fast" : "progress-clock"}
              variant="community"
              size={22}
              color={isDark ? "#4DA3FF" : "#2196F3"}
            />
            <Text style={styles.acceptedText} numberOfLines={1}>
              {arrivingLabel}
            </Text>
          </View>
        )}

        <View style={styles.itemsSectionHeader}>
          <Text style={styles.itemsSectionTitle}>Items</Text>
          <Text style={styles.itemsSectionMeta}>
            {items.length} product{items.length === 1 ? "" : "s"}
          </Text>
        </View>

        {items.map((item, i) => {
          const iconColor = pickPaletteColor(item.productId || item.name || i);
          return (
            <View
              key={`${item.productId || item.name}-${i}`}
              style={styles.itemCard}
            >
              <View
                style={[
                  styles.itemIconWrap,
                  {
                    backgroundColor: getLightIconBackground(
                      iconColor,
                      colors.surfaceMuted,
                    ),
                  },
                ]}
              >
                <AppIcon
                  name={item.iconName || item.icon || DEFAULT_PRODUCT_ICON}
                  variant="community"
                  size={20}
                  color={iconColor}
                />
              </View>
              <View style={styles.itemMain}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemSub}>
                  Qty {item.quantity} x ${Number(item.price).toFixed(2)}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                ${(item.quantity * item.price).toFixed(2)}
              </Text>
            </View>
          );
        })}

        {status === "pending" && (
          <>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.cancelActionCard}>
              <TouchableOpacity
                style={[
                  styles.cancelOrderButton,
                  !canCancelPendingOrder && styles.cancelOrderButtonDisabled,
                ]}
                onPress={handleCancelPendingOrder}
                disabled={!canCancelPendingOrder}
              >
                <AppIcon
                  name="close-circle-outline"
                  variant="community"
                  size={16}
                  color={colors.background}
                />
                <Text style={styles.cancelOrderButtonText}>
                  {cancellingOrder ? "Cancelling..." : "Cancel Order"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {status === "accepted" && (
          <>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.refundCard}>
              <Text style={styles.refundTitle}>Refund</Text>
              {renderRefundContent()}
            </View>
          </>
        )}

        {status === "completed" && (
          <>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.completionActionsRow}>
              <View style={[styles.refundCard, styles.completionActionCard]}>
                <Text style={styles.refundTitle}>Refund</Text>
                {renderRefundContent()}
              </View>

              <View style={[styles.invoiceCard, styles.completionActionCard]}>
                <Text style={styles.invoiceTitle}>Invoice</Text>
                <Text style={styles.invoiceMeta}>
                  Preview your invoice and save a PDF copy.
                </Text>
                <TouchableOpacity
                  style={styles.invoiceButton}
                  onPress={handleViewInvoice}
                >
                  <AppIcon
                    name="file-eye-outline"
                    variant="community"
                    size={16}
                    color={colors.background}
                  />
                  <Text style={styles.invoiceButtonText}>View Invoice</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.invoiceButtonAlt}
                  onPress={handleDownloadInvoice}
                >
                  <AppIcon
                    name="download"
                    variant="community"
                    size={14}
                    color={colors.text}
                  />
                  <Text style={styles.invoiceButtonAltText}>
                    Save Invoice (PDF)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.screen,
    },
    content: {
      padding: 16,
      paddingBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: "800",
      marginBottom: 10,
      color: colors.text,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 12,
      gap: 8,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    summaryLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSubtle,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    summaryValue: {
      flex: 1,
      textAlign: "right",
      fontSize: 13,
      color: colors.text,
      fontWeight: "600",
    },
    timelineContainer: {
      marginBottom: 12,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.border,
    },
    lineRight: {
      flex: 1,
      height: 3,
      backgroundColor: colors.border,
    },
    lineActive: {
      backgroundColor: colors.success,
    },
    stepContainer: {
      alignItems: "center",
      paddingHorizontal: 4,
    },
    stepCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: colors.background,
    },
    stepCircleActive: {
      backgroundColor: isDark ? colors.successSoft : "#e8f5e9",
      borderColor: colors.success,
    },
    stepCircleCurrent: {
      backgroundColor: isDark ? colors.successSoft : "#e8f5e9",
      borderColor: colors.success,
      borderWidth: 4,
    },
    stepLabel: {
      marginTop: 8,
      fontSize: 11,
      color: colors.textSubtle,
      textAlign: "center",
      fontWeight: "500",
    },
    stepLabelActive: {
      color: colors.textMuted,
      fontWeight: "600",
    },
    stepLabelCurrent: {
      color: isDark ? colors.tint : "#2196F3",
      fontWeight: "700",
    },
    cancelledBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: isDark ? colors.surfaceMuted : "#fbc6c6",
      borderWidth: 1,
      borderColor: colors.danger,
      padding: 10,
      borderRadius: 12,
      marginBottom: 12,
    },
    cancelledText: {
      color: colors.danger,
      fontWeight: "500",
      fontStyle: "",
      flex: 1,
    },
    acceptedBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "transparent",
      borderWidth: 0,
      paddingHorizontal: 0,
      paddingVertical: 2,
      marginBottom: 12,
    },
    acceptedText: {
      color: isDark ? "#4DA3FF" : "#2196F3",
      fontWeight: "500",
      fontSize: 13,
      fontStyle: "",
      flex: 1,
    },
    invoiceCard: {
      marginBottom: 16,
      padding: 12,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    invoiceTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 4,
      color: colors.text,
    },
    invoiceMeta: { fontSize: 12, color: colors.textSubtle, marginBottom: 10 },
    invoiceButton: {
      backgroundColor: colors.text,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
      marginBottom: 8,
    },
    invoiceButtonText: { color: colors.background, fontWeight: "600" },
    invoiceButtonAlt: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.text,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
    },
    invoiceButtonAltText: {
      color: colors.text,
      fontWeight: "600",
      fontSize: 12,
    },
    itemsSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    itemsSectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    itemsSectionMeta: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSubtle,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginTop: 6,
      marginBottom: 10,
    },
    itemCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 11,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      gap: 10,
    },
    itemIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    itemMain: {
      flex: 1,
    },
    refundCard: {
      marginBottom: 12,
      padding: 12,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    refundTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
    },
    refundButton: {
      backgroundColor: colors.text,
      borderRadius: 7,
      paddingVertical: 9,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 4,
    },
    refundButtonDisabled: {
      opacity: 0.7,
    },
    refundButtonText: {
      color: colors.background,
      fontWeight: "700",
      fontSize: 10,
    },
    refundMetaText: {
      fontSize: 12,
      color: colors.textSubtle,
      marginBottom: 8,
      lineHeight: 16,
    },
    refundPendingText: {
      fontSize: 13,
      color: colors.warning,
      fontWeight: "600",
    },
    refundSuccessText: {
      fontSize: 13,
      color: colors.success,
      fontWeight: "700",
    },
    cancelActionCard: {
      marginBottom: 12,
      padding: 12,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelOrderButton: {
      backgroundColor: colors.danger,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
    },
    cancelOrderButtonDisabled: {
      opacity: 0.7,
    },
    cancelOrderButtonText: {
      color: colors.background,
      fontWeight: "700",
      fontSize: 12,
    },
    completionActionsRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 10,
      marginBottom: 12,
    },
    completionActionCard: {
      flex: 1,
      marginBottom: 0,
    },
    itemName: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "700",
    },
    itemSub: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSubtle,
      fontWeight: "600",
    },
    itemTotal: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
    },
  });
