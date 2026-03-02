import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams } from "expo-router";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import AppIcon from "../../../src/components/AppIcon";
import PdfViewer from "../../../src/components/PdfViewer";
import { db } from "../../../src/firebase/firebaseConfig";
import { getStatusColors } from "../../../src/theme/statusPalette";
import { useAppTheme } from "../../../src/theme/useAppTheme";

const STATUS_ICONS = {
  pending: "progress-clock",
  accepted: "check-decagram",
  completed: "truck-check",
  cancelled: "close-circle",
};

export default function CustomerFullOrderDetails() {
  const { orderId } = useLocalSearchParams();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusColors = useMemo(
    () => getStatusColors(colors, isDark),
    [colors, isDark],
  );
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [invoiceUri, setInvoiceUri] = useState("");
  const [viewerVisible, setViewerVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState("");

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      const [snap, productsSnap] = await Promise.all([
        getDoc(doc(db, "orders", String(orderId))),
        getDocs(collection(db, "products")),
      ]);

      const productIconById = {};
      productsSnap.docs.forEach((productDoc) => {
        const data = productDoc.data();
        productIconById[String(productDoc.id)] =
          data?.iconName || data?.icon || "package-variant-closed";
      });

      if (snap.exists()) {
        const data = snap.data();
        const items = (data.items || []).map((item) => ({
          ...item,
          iconName:
            item.iconName ||
            productIconById[String(item.productId)] ||
            "package-variant-closed",
        }));
        setOrder({ id: snap.id, ...data, items });
      } else {
        setOrder(null);
      }
    } catch (error) {
      console.error("Failed to load order details:", error);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const total = useMemo(() => {
    if (!order?.items?.length) return 0;
    return order.items.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0,
    );
  }, [order]);

  const generateInvoiceHTML = useCallback(() => {
    if (!order || !order.items) {
      throw new Error("Invoice data not ready");
    }

    const now = new Date().toLocaleString();
    const totalItems = order.items.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    );

    const rows = order.items
      .map(
        (item) => `
          <tr>
            <td>${item.name || "Item"}${
              item.selectedOptionsLabel
                ? `<div style="font-size:12px;color:#555;margin-top:2px;">${item.selectedOptionsLabel}</div>`
                : ""
            }</td>
            <td>${item.merchantName || "—"}</td>
            <td style="text-align:center;">${Number(item.quantity || 0)}</td>
            <td style="text-align:right;">$${Number(item.price || 0).toFixed(2)}</td>
            <td style="text-align:right;">$${(
              Number(item.price || 0) * Number(item.quantity || 0)
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
            <p><b>Order ID:</b> ${order.id}</p>
            <p><b>Date/Time:</b> ${now}</p>
            <p><b>Payment method:</b> ${order.paymentMethod || "Card"}</p>
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
                <td style="text-align:right;">$${total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
  }, [order, total]);

  const getInvoiceUri = useCallback(async () => {
    if (invoiceUri) return invoiceUri;
    const html = generateInvoiceHTML();
    const { uri } = await Print.printToFileAsync({ html });
    setInvoiceUri(uri);
    return uri;
  }, [generateInvoiceHTML, invoiceUri]);

  const handleViewInvoice = useCallback(async () => {
    try {
      const uri = await getInvoiceUri();
      setPreviewUri(uri);
      setViewerVisible(true);
    } catch (error) {
      console.error("Invoice preview failed:", error);
    }
  }, [getInvoiceUri]);

  const handleDownloadInvoice = useCallback(async () => {
    try {
      const uri = await getInvoiceUri();
      await Sharing.shareAsync(uri);
    } catch (error) {
      console.error("Invoice download/share failed:", error);
    }
  }, [getInvoiceUri]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Order not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PdfViewer
        visible={viewerVisible}
        uri={previewUri}
        onClose={() => setViewerVisible(false)}
      />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryOrderId}>Order #{order.id}</Text>
        <Text style={styles.summaryMeta}>
          {order.createdAt?.toDate?.().toLocaleString() || "—"}
        </Text>
        <Text style={styles.summaryTotal}>${total.toFixed(2)}</Text>
      </View>

      <View style={styles.invoiceActions}>
        <TouchableOpacity style={styles.previewBtn} onPress={handleViewInvoice}>
          <Text style={styles.previewBtnText}>View invoice</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadInvoice}>
          <Text style={styles.downloadBtnText}>Download invoice</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Items</Text>
      {(order.items || []).map((item, idx) => {
        const status = order.merchantStatuses?.[item.merchantId]?.status || "pending";
        const statusColor = statusColors[status] || statusColors.pending;
        return (
          <View
            key={`${order.id}-${item.productId || item.name}-${idx}`}
            style={styles.itemRow}
          >
            <View style={styles.itemLeft}>
              <View style={styles.itemIconWrap}>
                <AppIcon
                  name={item.iconName || "package-variant-closed"}
                  variant="community"
                  size={20}
                  color={colors.text}
                />
              </View>
              <View style={styles.itemMeta}>
                <Text numberOfLines={1} style={styles.itemName}>
                  {item.name || "Item"}
                </Text>
                <Text style={styles.itemSub}>
                  Qty {Number(item.quantity || 0)} · $
                  {(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                </Text>
                {item.selectedOptionsLabel ? (
                  <Text style={styles.itemVariant} numberOfLines={1}>
                    {item.selectedOptionsLabel}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.itemRight}>
              <AppIcon
                name={STATUS_ICONS[status] || STATUS_ICONS.pending}
                variant="community"
                size={18}
                color={statusColor}
              />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {status[0].toUpperCase() + status.slice(1)}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.screen,
    },
    content: {
      padding: 16,
      paddingBottom: 20,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.screen,
      padding: 16,
    },
    emptyText: {
      color: colors.textSubtle,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 14,
    },
    summaryOrderId: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    summaryMeta: {
      fontSize: 12,
      color: colors.textSubtle,
      marginBottom: 10,
    },
    summaryTotal: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
    },
    invoiceActions: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 14,
    },
    previewBtn: {
      flex: 1,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.text,
      alignItems: "center",
      justifyContent: "center",
    },
    previewBtnText: {
      color: colors.background,
      fontSize: 13,
      fontWeight: "700",
    },
    downloadBtn: {
      flex: 1,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.text,
      alignItems: "center",
      justifyContent: "center",
    },
    downloadBtnText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
    },
    itemRow: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    itemLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 10,
    },
    itemIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    itemMeta: {
      flex: 1,
    },
    itemName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
    },
    itemSub: {
      fontSize: 12,
      color: colors.textSubtle,
    },
    itemVariant: {
      marginTop: 2,
      fontSize: 11,
      color: colors.textMuted,
    },
    itemRight: {
      minWidth: 94,
      alignItems: "flex-end",
      gap: 4,
    },
    statusText: {
      fontSize: 12,
      fontWeight: "700",
    },
  });
