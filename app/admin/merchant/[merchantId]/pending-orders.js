import { useLocalSearchParams } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../../../../src/components/ScreenContainer";
import { db } from "../../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../../src/theme/useAppTheme";

const toDate = (value) => {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(0);
};

const formatAge = (date) => {
  const ageMs = Date.now() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (ageMs >= dayMs) return `${Math.floor(ageMs / dayMs)}d`;
  const hourMs = 60 * 60 * 1000;
  if (ageMs >= hourMs) return `${Math.floor(ageMs / hourMs)}h`;
  return `${Math.max(1, Math.floor(ageMs / (60 * 1000)))}m`;
};

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "all", label: "All" },
];

const dateInPeriod = (date, periodKey) => {
  if (periodKey === "all") return true;
  const now = new Date();
  const start = new Date(now);

  if (periodKey === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (periodKey === "7d") {
    start.setDate(now.getDate() - 7);
  } else if (periodKey === "30d") {
    start.setDate(now.getDate() - 30);
  }

  return date >= start && date <= now;
};

const formatDateTime = (date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

export default function AdminMerchantPendingOrdersScreen() {
  const params = useLocalSearchParams();
  const merchantId = Array.isArray(params.merchantId)
    ? params.merchantId[0]
    : params.merchantId;
  const periodParam = Array.isArray(params.period) ? params.period[0] : params.period;
  const selectedPeriod = PERIODS.some((period) => period.key === periodParam)
    ? periodParam
    : "all";
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [merchantNameById, setMerchantNameById] = useState({});
  const [customerNameById, setCustomerNameById] = useState({});
  const [storeNameById, setStoreNameById] = useState({});
  const [productById, setProductById] = useState({});
  const [orders, setOrders] = useState([]);
  const [showExactDateByOrderId, setShowExactDateByOrderId] = useState({});

  useEffect(() => {
    if (!merchantId) return undefined;

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const merchantMap = {};
      const customerMap = {};
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const name = data?.name || data?.username || "Unknown user";
        merchantMap[docSnap.id] = name;
        customerMap[docSnap.id] = name;
      });
      setMerchantNameById(merchantMap);
      setCustomerNameById(customerMap);
    });

    const unsubStores = onSnapshot(collection(db, "stores"), (snap) => {
      const map = {};
      snap.docs.forEach((docSnap) => {
        map[docSnap.id] = docSnap.data()?.name || "Unknown store";
      });
      setStoreNameById(map);
    });

    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      const map = {};
      snap.docs.forEach((docSnap) => {
        map[docSnap.id] = {
          name: docSnap.data()?.name || "",
          storeId: docSnap.data()?.storeId || "",
        };
      });
      setProductById(map);
    });

    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
      setOrders(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })),
      );
    });

    return () => {
      unsubUsers();
      unsubStores();
      unsubProducts();
      unsubOrders();
    };
  }, [merchantId]);

  const pendingOrders = useMemo(() => {
    return orders
      .map((order) => {
        const merchantItems = (order.items || []).filter(
          (item) => item.merchantId === merchantId,
        );

        if (!merchantItems.length) return null;

        const merchantStatus =
          order.merchantStatuses?.[merchantId]?.status || order.status || "pending";
        if (merchantStatus !== "pending") return null;

        const createdAt = toDate(order.createdAt);
        if (!dateInPeriod(createdAt, selectedPeriod)) return null;
        const storeNames = [
          ...new Set(
            merchantItems
              .map((item) => {
                const storeId = productById[item.productId]?.storeId;
                return storeNameById[storeId] || "";
              })
              .filter(Boolean),
          ),
        ];

        const itemLines = merchantItems.map((item) => {
          const name = item.name || productById[item.productId]?.name || "Unnamed item";
          return `${name} (x${Number(item.quantity || 0)})`;
        });

        return {
          id: order.id,
          createdAt,
          customerId: order.customerId,
          storeNames,
          itemLines,
          itemsCount: merchantItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [orders, merchantId, productById, selectedPeriod, storeNameById]);

  const merchantName = merchantNameById[merchantId] || "Merchant";

  return (
    <ScreenContainer disableBottomInset bottomPadding={12}>
      <Text style={styles.title}>{merchantName}</Text>
      <Text style={styles.subtitle}>
        Pending orders ({PERIODS.find((period) => period.key === selectedPeriod)?.label || "All"}):{" "}
        {pendingOrders.length}
      </Text>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {pendingOrders.length === 0 ? (
          <Text style={styles.emptyText}>No pending orders for this merchant.</Text>
        ) : null}

        {pendingOrders.map((order) => (
          <View key={order.id} style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
              <Pressable
                onPress={() =>
                  setShowExactDateByOrderId((prev) => ({
                    ...prev,
                    [order.id]: !prev[order.id],
                  }))
                }
              >
                <Text style={styles.ageText}>
                  {showExactDateByOrderId[order.id]
                    ? formatDateTime(order.createdAt)
                    : `${formatAge(order.createdAt)} old`}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.meta}>Customer: {customerNameById[order.customerId] || "Unknown customer"}</Text>
            <Text style={styles.meta}>Stores: {order.storeNames.join(" • ") || "—"}</Text>
            <Text style={styles.meta}>Items ({order.itemsCount}): {order.itemLines.join(" • ") || "—"}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      marginTop: 4,
      marginBottom: 12,
      fontSize: 13,
      color: colors.textSubtle,
    },
    content: {
      gap: 10,
      paddingBottom: 8,
    },
    emptyText: {
      marginTop: 20,
      textAlign: "center",
      color: colors.textSubtle,
      fontSize: 13,
    },
    card: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 10,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    orderId: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    ageText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.warning,
    },
    meta: {
      marginTop: 3,
      fontSize: 12,
      color: colors.textSubtle,
    },
  });
