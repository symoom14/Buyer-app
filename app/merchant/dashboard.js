import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppIcon from "../../src/components/AppIcon";
import ScreenContainer from "../../src/components/ScreenContainer";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";

const LOW_STOCK_THRESHOLD = 10;
const LOW_STOCK_URGENT_THRESHOLD = 5;

function formatOrderAge(ageMs) {
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;

  if (ageMs >= month) {
    const value = Math.floor(ageMs / month);
    return `${value} month${value > 1 ? "s" : ""} old`;
  }
  if (ageMs >= week) {
    const value = Math.floor(ageMs / week);
    return `${value} week${value > 1 ? "s" : ""} old`;
  }
  if (ageMs >= day) {
    const value = Math.floor(ageMs / day);
    return `${value} day${value > 1 ? "s" : ""} old`;
  }
  if (ageMs >= hour) {
    const value = Math.floor(ageMs / hour);
    return `${value}h old`;
  }
  const value = Math.max(1, Math.floor(ageMs / minute));
  return `${value}m old`;
}

export default function MerchantDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors);

  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState({
    pendingOrders: 0,
    activeFulfillment: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    lowStockProducts: 0,
    todayRevenue: 0,
    revenue7d: 0,
    totalStores: 0,
  });
  const [merchantOrders, setMerchantOrders] = useState([]);
  const [merchantProducts, setMerchantProducts] = useState([]);

  useEffect(() => {
    let unsubscribeNotifications = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeNotifications();

      if (!user?.uid) {
        setHasUnreadNotifications(false);
        return;
      }

      const unreadQuery = query(
        collection(db, "notifications"),
        where("recipientId", "==", user.uid),
        where("read", "==", false),
      );

      unsubscribeNotifications = onSnapshot(
        unreadQuery,
        (snap) => {
          const hasUnread = snap.docs.some(
            (docSnap) => docSnap.data()?.recipientRole === "merchant",
          );
          setHasUnreadNotifications(hasUnread);
        },
        () => setHasUnreadNotifications(false),
      );
    });

    return () => {
      unsubscribeNotifications();
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    let unsubOrders = () => {};
    let unsubProducts = () => {};
    let unsubStores = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubOrders();
      unsubProducts();
      unsubStores();

      if (!user?.uid) {
        setLoadingStats(false);
        setMerchantOrders([]);
        setMerchantProducts([]);
        setStats({
          pendingOrders: 0,
          activeFulfillment: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          lowStockProducts: 0,
          todayRevenue: 0,
          revenue7d: 0,
          totalStores: 0,
        });
        return;
      }

      setLoadingStats(true);

      let ordersDocs = [];
      let productsDocs = [];
      let storesDocs = [];

      const recompute = () => {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const merchantProductRows = productsDocs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        const lowStockProducts = merchantProductRows.filter(
          (product) => Number(product.quantity ?? 0) <= LOW_STOCK_THRESHOLD,
        ).length;

        const merchantOrderRows = ordersDocs
          .map((docSnap) => {
            const data = docSnap.data();
            const merchantItems = (data.items || []).filter(
              (item) => item.merchantId === user.uid,
            );
            if (!merchantItems.length) return null;

            const merchantStatus =
              data.merchantStatuses?.[user.uid]?.status ||
              data.status ||
              "pending";
            const createdAt = data.createdAt?.toDate?.() || new Date(0);
            const merchantTotal = merchantItems.reduce(
              (sum, item) =>
                sum + Number(item.price || 0) * Number(item.quantity || 0),
              0,
            );

            return {
              id: docSnap.id,
              status: merchantStatus,
              createdAt,
              merchantTotal,
              items: merchantItems,
            };
          })
          .filter(Boolean);

        const pendingOrders = merchantOrderRows.filter(
          (row) => row.status === "pending",
        ).length;
        const activeFulfillment = merchantOrderRows.filter(
          (row) => row.status === "accepted",
        ).length;
        const completedOrders = merchantOrderRows.filter(
          (row) => row.status === "completed",
        ).length;
        const cancelledOrders = merchantOrderRows.filter(
          (row) => row.status === "cancelled",
        ).length;

        const todayRevenue = merchantOrderRows
          .filter(
            (row) =>
              row.createdAt >= startOfToday && row.status !== "cancelled",
          )
          .reduce((sum, row) => sum + row.merchantTotal, 0);

        const revenue7d = merchantOrderRows
          .filter(
            (row) =>
              row.createdAt >= sevenDaysAgo && row.status !== "cancelled",
          )
          .reduce((sum, row) => sum + row.merchantTotal, 0);

        setMerchantOrders(merchantOrderRows);
        setMerchantProducts(merchantProductRows);
        setStats({
          pendingOrders,
          activeFulfillment,
          completedOrders,
          cancelledOrders,
          lowStockProducts,
          todayRevenue,
          revenue7d,
          totalStores: storesDocs.length,
        });
        setLoadingStats(false);
      };

      unsubOrders = onSnapshot(
        collection(db, "orders"),
        (snap) => {
          ordersDocs = snap.docs;
          recompute();
        },
        () => setLoadingStats(false),
      );

      unsubProducts = onSnapshot(
        query(collection(db, "products"), where("merchantId", "==", user.uid)),
        (snap) => {
          productsDocs = snap.docs;
          recompute();
        },
        () => setLoadingStats(false),
      );

      unsubStores = onSnapshot(
        query(collection(db, "stores"), where("merchantId", "==", user.uid)),
        (snap) => {
          storesDocs = snap.docs;
          recompute();
        },
        () => setLoadingStats(false),
      );
    });

    return () => {
      unsubOrders();
      unsubProducts();
      unsubStores();
      unsubscribeAuth();
    };
  }, []);

  const lowStockUrgent = stats.lowStockProducts > LOW_STOCK_URGENT_THRESHOLD;

  const priorities = useMemo(
    () => [
      stats.pendingOrders > 0
        ? `Confirm ${stats.pendingOrders} new order${stats.pendingOrders > 1 ? "s" : ""}.`
        : "Review latest order activity.",
      stats.lowStockProducts > 0
        ? `Restock ${stats.lowStockProducts} low-stock product${stats.lowStockProducts > 1 ? "s" : ""}.`
        : "No low-stock alerts right now.",
      `Track today: $${stats.todayRevenue.toFixed(2)} revenue so far.`,
    ],
    [stats.lowStockProducts, stats.pendingOrders, stats.todayRevenue],
  );

  const actionCards = [
    {
      label: "New orders",
      value: loadingStats ? "…" : String(stats.pendingOrders),
      hint: "Needs confirmation",
      icon: "receipt-clock",
      iconColor: "#9C6B00",
      backgroundColor: "#FFF1CC",
      onPress: () =>
        router.push({
          pathname: "/merchant/orders",
          params: { status: "pending" },
        }),
    },
    {
      label: "Items need immediate action",
      value: loadingStats ? "…" : String(stats.lowStockProducts),
      hint: `Stock at or below ${LOW_STOCK_THRESHOLD}`,
      icon: "alert-circle-outline",
      iconColor: "#B3261E",
      backgroundColor: "#FFE6E2",
      onPress: () =>
        router.push({
          pathname: "/merchant/stores/products",
          params: { stock: "low" },
        }),
    },
    {
      label: "Low stock",
      value: loadingStats ? "…" : String(stats.lowStockProducts),
      hint: `Products at or below ${LOW_STOCK_THRESHOLD}`,
      icon: "package-variant-closed-plus",
      iconColor: lowStockUrgent ? "#B3261E" : "#1E8E3E",
      backgroundColor: lowStockUrgent ? "#FFE6E2" : "#E8F7EC",
      onPress: () =>
        router.push({
          pathname: "/merchant/stores/products",
          params: { stock: "low" },
        }),
    },
    {
      label: "Today's revenue",
      value: loadingStats ? "…" : `$${stats.todayRevenue.toFixed(2)}`,
      hint: "Non-cancelled orders",
      icon: "cash-fast",
      iconColor: "#0B6BE0",
      backgroundColor: "#DFF2FF",
      onPress: () =>
        router.push({
          pathname: "/merchant/stores/analytics",
          params: { mode: "earnings", period: "today" },
        }),
    },
  ];

  const operationalQueueRows = [
    {
      key: "pending-orders",
      title: "Orders needing confirmation",
      subtitle: loadingStats ? "Loading…" : `${stats.pendingOrders} pending`,
      icon: "receipt-clock",
      iconColor: "#9C6B00",
      backgroundColor: "#FFF1CC",
      onPress: () =>
        router.push({
          pathname: "/merchant/orders",
          params: { status: "pending" },
        }),
    },
    {
      key: "accepted-orders",
      title: "Fulfillment in progress",
      subtitle: loadingStats
        ? "Loading…"
        : `${stats.activeFulfillment} accepted`,
      icon: "receipt-text-arrow-right",
      iconColor: "#0B6BE0",
      backgroundColor: "#DFF2FF",
      onPress: () =>
        router.push({
          pathname: "/merchant/orders",
          params: { status: "accepted" },
        }),
    },
    {
      key: "cancelled-orders",
      title: "Review cancelled orders",
      subtitle: loadingStats
        ? "Loading…"
        : `${stats.cancelledOrders} cancelled`,
      icon: "close-box-outline",
      iconColor: "#B3261E",
      backgroundColor: "#FFE6E2",
      onPress: () =>
        router.push({
          pathname: "/merchant/orders",
          params: { status: "cancelled" },
        }),
    },
  ];

  const topMovers = useMemo(() => {
    const byProduct = {};
    merchantOrders.forEach((order) => {
      if (order.status === "cancelled") return;
      (order.items || []).forEach((item) => {
        const key = String(item.productId || item.name || "");
        if (!key) return;
        if (!byProduct[key]) {
          byProduct[key] = {
            key,
            productId: item.productId || "",
            name: item.name || "Unnamed product",
            units: 0,
            revenue: 0,
          };
        }
        byProduct[key].units += Number(item.quantity || 0);
        byProduct[key].revenue +=
          Number(item.price || 0) * Number(item.quantity || 0);
      });
    });

    const qtyByProduct = {};
    const iconByProduct = {};
    merchantProducts.forEach((product) => {
      qtyByProduct[String(product.id)] = Number(product.quantity ?? 0);
      iconByProduct[String(product.id)] =
        product.iconName || product.icon || "package-variant-closed";
    });

    return Object.values(byProduct)
      .sort((a, b) => b.units - a.units)
      .slice(0, 5)
      .map((row) => ({
        ...row,
        remainingQty:
          row.productId && qtyByProduct[row.productId] != null
            ? qtyByProduct[row.productId]
            : null,
        iconName:
          row.productId && iconByProduct[row.productId]
            ? iconByProduct[row.productId]
            : "package-variant-closed",
      }));
  }, [merchantOrders, merchantProducts]);

  const atRiskOrders = useMemo(() => {
    const now = Date.now();
    return merchantOrders
      .filter((order) => {
        const ageMs = now - order.createdAt.getTime();
        if (order.status === "pending") return ageMs > 2 * 60 * 60 * 1000;
        if (order.status === "accepted") return ageMs > 24 * 60 * 60 * 1000;
        return false;
      })
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        status: order.status,
        ageLabel: formatOrderAge(now - order.createdAt.getTime()),
        total: order.merchantTotal,
      }));
  }, [merchantOrders]);

  const utilityRows = [
    {
      key: "manage-stores",
      title: "Manage stores",
      subtitle: loadingStats
        ? "Loading…"
        : `${stats.totalStores} active stores`,
      icon: "store",
      onPress: () => router.push("/merchant/stores/manage"),
    },
    {
      key: "add-store",
      title: "Add new store",
      subtitle: "Create and publish a new storefront",
      icon: "store-plus",
      onPress: () => router.push("/merchant/stores/add"),
    },
    {
      key: "product-management",
      title: "Product management",
      subtitle: "Edit products, quantities and stores",
      icon: "archive-cog",
      onPress: () => router.push("/merchant/stores/products"),
    },
    {
      key: "orders-workspace",
      title: "Orders workspace",
      subtitle: "Search and update all order statuses",
      icon: "receipt-text",
      onPress: () => router.push("/merchant/orders"),
    },
    {
      key: "analytics",
      title: "Store analytics",
      subtitle: "Open performance and earnings trends",
      icon: "chart-line",
      onPress: () =>
        router.push({
          pathname: "/merchant/stores/analytics",
          params: { mode: "store", period: "7d" },
        }),
    },
  ];

  return (
    <ScreenContainer disableBottomInset bottomPadding={0}>
      <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
        <View style={styles.heroRow}>
          <Text style={styles.heroTitle}>Merchant</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push("/merchant/notifications")}
            >
              <AppIcon
                name={hasUnreadNotifications ? "bell-badge" : "bell-outline"}
                variant="community"
                size={26}
                color={colors.merchantHeaderText}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push("/merchant/profile")}
            >
              <Ionicons
                name="person-circle-outline"
                size={30}
                color={colors.merchantHeaderText}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.priorityBlock}>
          <Text style={styles.priorityTitle}>Today&apos;s priorities</Text>
          {priorities.map((item) => (
            <View key={item} style={styles.priorityRow}>
              <AppIcon
                name="check-circle-outline"
                variant="community"
                size={16}
                color={colors.textSubtle}
              />
              <Text style={styles.priorityText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Action center</Text>
          <View style={styles.summaryGrid}>
            {actionCards.map((card) => (
              <TouchableOpacity
                key={card.label}
                style={[
                  styles.summaryCard,
                  { backgroundColor: card.backgroundColor },
                ]}
                onPress={card.onPress}
              >
                <View style={styles.summaryCardHeader}>
                  <AppIcon
                    name={card.icon}
                    variant="community"
                    size={20}
                    color={card.iconColor}
                  />
                  <AppIcon
                    name="chevron-right"
                    variant="community"
                    size={18}
                    color={card.iconColor}
                  />
                </View>
                <Text style={styles.summaryValue}>{card.value}</Text>
                <Text style={styles.summaryLabel}>{card.label}</Text>
                <Text style={styles.summaryHint}>{card.hint}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Operational queues</Text>
          {operationalQueueRows.map((row) => (
            <TouchableOpacity
              key={row.key}
              style={styles.compactCard}
              onPress={row.onPress}
            >
              <View
                style={[
                  styles.compactCardIconWrap,
                  { backgroundColor: row.backgroundColor },
                ]}
              >
                <AppIcon
                  name={row.icon}
                  variant="community"
                  size={18}
                  color={row.iconColor}
                />
              </View>
              <View style={styles.compactCardMeta}>
                <Text style={styles.compactCardTitle}>{row.title}</Text>
                <Text style={styles.compactCardSub}>{row.subtitle}</Text>
              </View>
              <AppIcon
                name="arrow-right"
                variant="community"
                size={20}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>At-risk orders</Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/merchant/orders",
                  params: { status: "pending" },
                })
              }
            >
              <Text style={styles.sectionLink}>Open orders</Text>
            </TouchableOpacity>
          </View>
          {atRiskOrders.length === 0 ? (
            <Text style={styles.emptyInfo}>No aging orders right now.</Text>
          ) : (
            atRiskOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.compactCard}
                onPress={() => router.push(`/merchant/orders/${order.id}`)}
              >
                <View style={[styles.compactCardIconWrap, styles.riskIconWrap]}>
                  <AppIcon
                    name="timer-sand-empty"
                    variant="community"
                    size={18}
                    color="#B3261E"
                  />
                </View>
                <View style={styles.compactCardMeta}>
                  <Text style={styles.compactCardTitle}>
                    Order {order.id.slice(0, 8)}
                  </Text>
                  <Text style={styles.compactCardSub}>
                    {order.status} · {order.ageLabel} · $
                    {order.total.toFixed(2)}
                  </Text>
                </View>
                <AppIcon
                  name="arrow-right"
                  variant="community"
                  size={20}
                  color={colors.textSubtle}
                />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Top products</Text>
            <TouchableOpacity
              onPress={() => router.push("/merchant/stores/products")}
            >
              <Text style={styles.sectionLink}>View products</Text>
            </TouchableOpacity>
          </View>
          {topMovers.length === 0 ? (
            <Text style={styles.emptyInfo}>No product movement yet.</Text>
          ) : (
            topMovers.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.compactCard}
                onPress={() => router.push("/merchant/stores/products")}
              >
                <View
                  style={[styles.compactCardIconWrap, styles.moverIconWrap]}
                >
                  <AppIcon
                    name={item.iconName}
                    variant="community"
                    size={18}
                    color={isDark ? "#0B6BE0" : colors.text}
                  />
                </View>
                <View style={styles.compactCardMeta}>
                  <Text style={styles.compactCardTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.compactCardSub}>
                    {item.units} sold · ${item.revenue.toFixed(2)}
                    {item.remainingQty != null
                      ? ` · ${item.remainingQty} left`
                      : ""}
                  </Text>
                </View>
                <AppIcon
                  name="arrow-right"
                  variant="community"
                  size={20}
                  color={colors.textSubtle}
                />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Merchant tools</Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/merchant/stores/analytics",
                  params: { mode: "earnings", period: "7d" },
                })
              }
            >
              <Text style={styles.sectionLink}>
                {loadingStats
                  ? "7-day earnings"
                  : `7-day earnings $${stats.revenue7d.toFixed(0)}`}
              </Text>
            </TouchableOpacity>
          </View>
          {utilityRows.map((row) => (
            <TouchableOpacity
              key={row.key}
              style={styles.compactCard}
              onPress={row.onPress}
            >
              <View style={styles.compactCardIconWrap}>
                <AppIcon
                  name={row.icon}
                  variant="community"
                  size={18}
                  color={colors.text}
                />
              </View>
              <View style={styles.compactCardMeta}>
                <Text style={styles.compactCardTitle}>{row.title}</Text>
                <Text style={styles.compactCardSub}>{row.subtitle}</Text>
              </View>
              <AppIcon
                name="arrow-right"
                variant="community"
                size={20}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    hero: {
      backgroundColor: colors.merchantHeaderBg,
      marginHorizontal: -16,
      marginTop: -16,
      paddingHorizontal: 16,
      paddingBottom: 50,
      marginBottom: 20,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
    },
    heroTitle: {
      fontSize: 42,
      fontWeight: "800",
      color: colors.merchantHeaderText,
    },
    heroRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    actionBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      paddingBottom: 16,
    },
    priorityBlock: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderRadius: 12,
      padding: 12,
      marginBottom: 20,
    },
    priorityTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
    },
    priorityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    priorityText: {
      flex: 1,
      fontSize: 13,
      color: colors.textMuted,
    },
    sectionBlock: {
      marginBottom: 24,
    },
    sectionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 12,
    },
    sectionLink: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.tint,
    },
    emptyInfo: {
      fontSize: 13,
      color: colors.textSubtle,
      marginBottom: 2,
    },
    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    summaryCard: {
      width: 160,
      minHeight: 128,
      borderRadius: 12,
      padding: 12,
    },
    summaryCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: "800",
      color: "#111111",
      marginBottom: 2,
    },
    summaryLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: "#111111",
      marginBottom: 2,
    },
    summaryHint: {
      fontSize: 11,
      color: "#333333",
    },
    queueCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    queueLeft: {
      flex: 1,
      paddingRight: 10,
    },
    queueTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
    },
    queueMeta: {
      fontSize: 12,
      color: colors.textSubtle,
    },
    compactCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    compactCardIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    moverIconWrap: {
      backgroundColor: "#DFF2FF",
    },
    riskIconWrap: {
      backgroundColor: "#FFE6E2",
    },
    compactCardMeta: {
      flex: 1,
      paddingRight: 8,
    },
    compactCardTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
    },
    compactCardSub: {
      fontSize: 12,
      color: colors.textSubtle,
    },
  });
