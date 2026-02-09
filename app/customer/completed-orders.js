import { useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { useCallback, useState } from "react";
import * as Haptics from "expo-haptics";
import {
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";

import AppIcon from "../../src/components/AppIcon";
import { auth, db } from "../../src/firebase/firebaseConfig";

const STATUS_ICONS = {
  pending: "receipt-clock",
  accepted: "receipt-text-arrow-right",
  completed: "receipt-text-check",
  cancelled: "close-box",
};

const STATUS_COLORS = {
  pending: "#FFB300",
  accepted: "#2196F3",
  completed: "#4CAF50",
  cancelled: "#F44336",
};

export default function CustomerCompletedOrders() {
  const [orders, setOrders] = useState([]);
  const router = useRouter();
  const [expandedId, setExpandedId] = useState(null);

  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const fetchOrders = async (customerId) => {
    const snapshot = await getDocs(collection(db, "orders"));

    const grouped = snapshot.docs.flatMap((docSnap) => {
      const data = docSnap.data();
      if (data.customerId !== customerId) return [];

      const itemsByMerchant = {};

      (data.items || []).forEach((item) => {
        if (!itemsByMerchant[item.merchantId]) {
          itemsByMerchant[item.merchantId] = [];
        }
        itemsByMerchant[item.merchantId].push(item);
      });

      return Object.entries(itemsByMerchant).map(([merchantId, items]) => {
        const names = items.map((i) => i.name).filter(Boolean);
        const primary = names[0];
        const extra = names.length - 1;

        const status =
          data.merchantStatuses?.[merchantId]?.status || "pending";

        return {
          id: `${docSnap.id}:${merchantId}`,
          orderId: docSnap.id,
          merchantId,
          merchantName: items[0]?.merchantName || "Store",
          createdAt: data.createdAt,
          total: items.reduce((s, i) => s + i.quantity * i.price, 0),
          status,
          itemSummary:
            extra > 0 ? `${primary} +${extra} more` : primary || "Order",
          items,
          totalItems: items.reduce((s, i) => s + (i.quantity || 0), 0),
        };
      });
    });

    setOrders(
      grouped
        .filter((order) => order.status === "completed")
        .sort(
          (a, b) => b.createdAt?.toMillis?.() - a.createdAt?.toMillis?.(),
        ),
    );
  };

  useFocusEffect(
    useCallback(() => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) fetchOrders(user.uid);
      });
      return unsub;
    }, []),
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isExpanded = expandedId === item.id;
          const previewItems = item.items?.slice(0, 3) || [];
          const extraCount = (item.items?.length || 0) - previewItems.length;
          return (
            <View>
              <Pressable
                style={styles.card}
                onPress={() =>
                  router.push(
                    `/customer/orders/${item.orderId}?merchantId=${item.merchantId}`,
                  )
                }
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  setExpandedId((prev) =>
                    prev === item.id ? null : item.id,
                  );
                }}
              >
                <View>
                  <Text style={styles.title}>{item.itemSummary}</Text>
                  <Text style={styles.sub}>{item.merchantName}</Text>
                  <Text style={styles.meta}>
                    {item.createdAt?.toDate?.().toLocaleString() || "—"}
                  </Text>
                </View>

                <View style={styles.right}>
                  <AppIcon
                    variant="community"
                    name={STATUS_ICONS[item.status]}
                    color={STATUS_COLORS[item.status]}
                    size={26}
                  />
                  <Text style={styles.price}>${item.total.toFixed(2)}</Text>
                </View>
              </Pressable>

              {isExpanded && (
                <View style={styles.preview}>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Status</Text>
                    <Text style={styles.previewValue}>
                      {(item.status || "pending").toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Items</Text>
                    <Text style={styles.previewValue}>{item.totalItems}</Text>
                  </View>
                  {previewItems.map((p, idx) => (
                    <Text key={`${item.id}-p-${idx}`} style={styles.previewItem}>
                      {p.name} × {p.quantity}
                    </Text>
                  ))}
                  {extraCount > 0 && (
                    <Text style={styles.previewMore}>
                      +{extraCount} more item{extraCount > 1 ? "s" : ""}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F2F2F7",
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 9,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: "600" },
  sub: { fontSize: 13, color: "#666", marginTop: 4 },
  meta: { fontSize: 12, color: "#777", marginTop: 4 },
  right: { alignItems: "flex-end", gap: 6 },
  price: { fontSize: 16, fontWeight: "700" },
  preview: {
    marginTop: -6,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  previewLabel: {
    fontSize: 12,
    color: "#777",
    fontWeight: "600",
  },
  previewValue: {
    fontSize: 12,
    color: "#111",
    fontWeight: "600",
  },
  previewItem: {
    fontSize: 13,
    color: "#111",
    marginTop: 2,
  },
  previewMore: {
    fontSize: 12,
    color: "#777",
    marginTop: 4,
  },
});
