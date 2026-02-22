import { useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
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
import { useAppTheme } from "../../src/theme/useAppTheme";
import { getStatusColors } from "../../src/theme/statusPalette";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

const STATUS_ICONS = {
  pending: "receipt-clock",
  accepted: "receipt-text-arrow-right",
  completed: "receipt-text-check",
  cancelled: "close-box",
};

export default function CustomerCompletedOrders() {
  const [orders, setOrders] = useState([]);
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [expandedId, setExpandedId] = useState(null);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusColors = useMemo(
    () => getStatusColors(colors, isDark),
    [colors, isDark],
  );

  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const fetchOrders = async (customerId) => {
    const [snapshot, usersSnapshot] = await Promise.all([
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "users")),
    ]);
    const merchantNameById = {};
    usersSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.role === "merchant") {
        merchantNameById[docSnap.id] = getUserDisplayName(data, "Store");
      }
    });

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
          merchantName:
            merchantNameById[merchantId] || items[0]?.merchantName || "Store",
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
                    color={statusColors[item.status] || statusColors.pending}
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

const createStyles = (colors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.screen,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 9,
    backgroundColor: colors.surface,
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: "600", color: colors.text },
  sub: { fontSize: 13, color: colors.textSubtle, marginTop: 4 },
  meta: { fontSize: 12, color: colors.textSubtle, marginTop: 4 },
  right: { alignItems: "flex-end", gap: 6 },
  price: { fontSize: 16, fontWeight: "700", color: colors.text },
  preview: {
    marginTop: -6,
    marginBottom: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  previewLabel: {
    fontSize: 12,
    color: colors.textSubtle,
    fontWeight: "600",
  },
  previewValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "600",
  },
  previewItem: {
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
  },
  previewMore: {
    fontSize: 12,
    color: colors.textSubtle,
    marginTop: 4,
  },
});
