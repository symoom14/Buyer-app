import * as Print from "expo-print";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import PdfViewer from "../../../src/components/PdfViewer";
import ScreenContainer from "../../../src/components/ScreenContainer";
import { db } from "../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../src/theme/useAppTheme";

export default function InvoicePage() {
  const { orderId } = useLocalSearchParams();
  const { colors } = useAppTheme();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invoiceUri, setInvoiceUri] = useState("");
  const [viewerVisible, setViewerVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState("");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchOrder = useCallback(async () => {
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
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

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

  const handleShareInvoice = async () => {
    try {
      const uri = await getInvoiceUri();
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
        <Text style={styles.unavailableText}>Invoice not available yet.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PdfViewer
        visible={viewerVisible}
        uri={previewUri}
        onClose={() => setViewerVisible(false)}
      />

      <Text style={styles.successTitle}>Payment successful!</Text>
      <Text style={styles.subHeading}>
        Your order will be processed by the seller soon.
      </Text>
      <Text style={styles.helperText}>
        You can preview your invoice and save/share a PDF copy from here.
      </Text>

      <TouchableOpacity style={styles.previewBtn} onPress={handleViewInvoice}>
        <Text style={styles.previewBtnText}>View Invoice</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.shareBtn} onPress={handleShareInvoice}>
        <Text style={styles.shareText}>Save Invoice (PDF)</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  successTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.success,
    marginBottom: 20,
  },
  subHeading: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 50,
  },
  helperText: {
    fontSize: 14,
    color: colors.textSubtle,
    marginBottom: 18,
  },
  previewBtn: {
    backgroundColor: colors.text,
    padding: 14,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 10,
  },
  previewBtnText: {
    color: colors.background,
    fontWeight: "600",
  },
  shareBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.text,
    padding: 14,
    borderRadius: 6,
    alignItems: "center",
  },
  shareText: {
    color: colors.text,
    fontWeight: "600",
  },
  unavailableText: {
    color: colors.textSubtle,
  },
});
