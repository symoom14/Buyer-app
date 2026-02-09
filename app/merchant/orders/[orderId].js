import { useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import ScreenContainer from "../../../src/components/ScreenContainer";
import { auth, db } from "../../../src/firebase/firebaseConfig";

export default function MerchantOrderDetailsScreen() {
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, []);

  const fetchOrder = async () => {
    try {
      const snap = await getDoc(doc(db, "orders", orderId));
      if (!snap.exists()) return;

      const data = snap.data();
      setOrder(data);

      // Resolve customer username
      if (data.customerId) {
        const userSnap = await getDoc(doc(db, "users", data.customerId));
        if (userSnap.exists()) {
          setCustomerName(userSnap.data().username);
        }
      }
    } catch (err) {
      console.error("Failed to load order:", err);
    } finally {
      setLoading(false);
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
        <Text>Order not available.</Text>
      </ScreenContainer>
    );
  }

  const date = order.createdAt?.toDate?.();
  const merchantId = auth.currentUser?.uid;

  // 🔒 FILTER ITEMS TO THIS MERCHANT ONLY
  const merchantItems = order.items.filter(
    (item) => item.merchantId === merchantId,
  );

  const totalItems = merchantItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  const merchantTotal = merchantItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <Text style={styles.title}>Order Details</Text>

      <View style={styles.metaBlock}>
        <Text style={styles.meta}>
          <Text style={styles.metaLabel}>Order ID: </Text>
          {orderId}
        </Text>

        <Text style={styles.meta}>
          <Text style={styles.metaLabel}>Date: </Text>
          {date ? date.toLocaleString() : "—"}
        </Text>

        <Text style={styles.meta}>
          <Text style={styles.metaLabel}>Customer: </Text>
          {customerName || "—"}
        </Text>

        <Text style={styles.meta}>
          <Text style={styles.metaLabel}>Total items: </Text>
          {totalItems}
        </Text>
      </View>

      {/* Items table */}
      <View style={styles.table}>
        <View style={styles.rowHeader}>
          <Text style={[styles.cell, styles.flex2]}>Item</Text>
          <Text style={[styles.cell, styles.center]}>Qty</Text>
          <Text style={[styles.cell, styles.right]}>Price</Text>
          <Text style={[styles.cell, styles.right]}>Total</Text>
        </View>

        {merchantItems.map((item, index) => (
          <View key={index} style={styles.row}>
            <Text style={[styles.cell, styles.flex2]}>{item.name}</Text>
            <Text style={[styles.cell, styles.center]}>{item.quantity}</Text>
            <Text style={[styles.cell, styles.right]}>
              ${item.price.toFixed(2)}
            </Text>
            <Text style={[styles.cell, styles.right]}>
              ${(item.price * item.quantity).toFixed(2)}
            </Text>
          </View>
        ))}

        {/* Summary */}
        <View style={styles.summaryRow}>
          <Text style={[styles.cell, styles.flex2]}>Totals</Text>
          <Text style={[styles.cell, styles.center]}>{totalItems}</Text>
          <Text style={styles.cell} />
          <Text style={[styles.cell, styles.right]}>
            ${merchantTotal.toFixed(2)}
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 16,
  },
  metaBlock: {
    marginBottom: 20,
  },
  meta: {
    fontSize: 14,
    marginBottom: 6,
  },
  metaLabel: {
    fontWeight: "600",
  },
  table: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    overflow: "hidden",
  },
  rowHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  summaryRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderTopWidth: 2,
    borderColor: "#ddd",
    backgroundColor: "#fafafa",
  },
  cell: {
    paddingHorizontal: 8,
    fontSize: 13,
  },
  flex2: {
    flex: 2,
  },
  center: {
    flex: 1,
    textAlign: "center",
  },
  right: {
    flex: 1,
    textAlign: "right",
  },
});
