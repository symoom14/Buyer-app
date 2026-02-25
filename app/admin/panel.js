import { collection, onSnapshot } from "firebase/firestore";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "../../src/components/AppIcon";
import LogoutButton from "../../src/components/LogoutButton";
import ScreenContainer from "../../src/components/ScreenContainer";
import { db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";

const LOW_STOCK_THRESHOLD = 10;

const normalizeRole = (value) => String(value || "").trim().toLowerCase();

const toDate = (value) => {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(0);
};

const formatMoney = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatOrderTotal = (orderData) => {
  const directTotal = Number(orderData.totalAmount ?? orderData.total ?? 0);
  if (directTotal > 0) return directTotal;

  const items = Array.isArray(orderData.items) ? orderData.items : [];
  return items.reduce(
    (sum, item) =>
      sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );
};

export default function AdminPanel() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    customers: 0,
    merchants: 0,
    stores: 0,
    products: 0,
    orders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalPaid: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);

  useEffect(() => {
    let usersDocs = [];
    let storesDocs = [];
    let productsDocs = [];
    let ordersDocs = [];

    const recompute = () => {
      const users = usersDocs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      const nonAdminUsers = users.filter(
        (user) => normalizeRole(user.role) !== "admin",
      );
      const userMap = new Map(users.map((user) => [user.id, user]));

      const orders = ordersDocs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));

      const products = productsDocs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const roleCounts = users.reduce(
        (acc, user) => {
          const role = normalizeRole(user.role);
          if (role === "customer") acc.customers += 1;
          if (role === "merchant") acc.merchants += 1;
          return acc;
        },
        { customers: 0, merchants: 0 },
      );

      const pendingOrders = orders.filter((order) => order.status === "pending").length;
      const completedOrders = orders.filter(
        (order) => order.status === "completed",
      ).length;
      const cancelledOrders = orders.filter(
        (order) => order.status === "cancelled",
      ).length;
      const totalPaid = orders.reduce(
        (sum, order) => sum + formatOrderTotal(order),
        0,
      );

      setStats({
        users: nonAdminUsers.length,
        customers: roleCounts.customers,
        merchants: roleCounts.merchants,
        stores: storesDocs.length,
        products: products.length,
        orders: orders.length,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        totalPaid,
      });

      setRecentOrders(
        orders.slice(0, 5).map((order) => ({
          id: order.id,
          status: order.status || "pending",
          total: formatOrderTotal(order),
          customerName:
            userMap.get(order.customerId)?.name ||
            userMap.get(order.customerId)?.username ||
            "Unknown customer",
        })),
      );

      setRecentUsers(
        users
          .slice()
          .sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt))
          .slice(0, 5)
          .map((user) => ({
            id: user.id,
            name: user.name || user.username || "Unnamed",
            role: normalizeRole(user.role) || "unknown",
          })),
      );

      setLowStockProducts(
        products
          .filter((product) => Number(product.quantity ?? 0) <= LOW_STOCK_THRESHOLD)
          .sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0))
          .slice(0, 5)
          .map((product) => ({
            id: product.id,
            name: product.name || "Unnamed product",
            qty: Number(product.quantity ?? 0),
            merchantName:
              userMap.get(product.merchantId)?.name ||
              userMap.get(product.merchantId)?.username ||
              "Unknown merchant",
          })),
      );

      setLoading(false);
    };

    const unsubs = [
      onSnapshot(
        collection(db, "users"),
        (snap) => {
          usersDocs = snap.docs;
          recompute();
        },
        () => setLoading(false),
      ),
      onSnapshot(
        collection(db, "stores"),
        (snap) => {
          storesDocs = snap.docs;
          recompute();
        },
        () => setLoading(false),
      ),
      onSnapshot(
        collection(db, "products"),
        (snap) => {
          productsDocs = snap.docs;
          recompute();
        },
        () => setLoading(false),
      ),
      onSnapshot(
        collection(db, "orders"),
        (snap) => {
          ordersDocs = snap.docs;
          recompute();
        },
        () => setLoading(false),
      ),
    ];

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  return (
    <ScreenContainer bottomPadding={90}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Platform Control</Text>
          <Text style={styles.headerSubtitle}>
            Live overview of accounts, inventory, and fulfillment.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Core Metrics</Text>
          <View style={styles.metricGrid}>
            <MetricTile
              label="Users"
              value={stats.users}
              icon="account-group"
              styles={styles}
              onPress={() => router.push("/admin/users")}
            />
            <MetricTile
              label="Stores"
              value={stats.stores}
              icon="store"
              styles={styles}
              onPress={() => router.push("/admin/stores")}
            />
            <MetricTile
              label="Products"
              value={stats.products}
              icon="package-variant"
              styles={styles}
            />
            <MetricTile
              label="Orders"
              value={stats.orders}
              icon="clipboard-list"
              styles={styles}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Role Mix</Text>
          <View style={styles.metricGrid}>
            <MetricTile
              label="Customers"
              value={stats.customers}
              icon="account"
              styles={styles}
            />
            <MetricTile
              label="Merchants"
              value={stats.merchants}
              icon="storefront"
              styles={styles}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Revenue Flow</Text>
          <RevenueFlowTile
            label="Total Paid by Customers"
            value={formatMoney(stats.totalPaid)}
            styles={styles}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Health</Text>
          <View style={styles.metricRow}>
            <StatusPill
              label="Pending"
              value={stats.pendingOrders}
              tone="warning"
              styles={styles}
            />
            <StatusPill
              label="Completed"
              value={stats.completedOrders}
              tone="success"
              styles={styles}
            />
            <StatusPill
              label="Cancelled"
              value={stats.cancelledOrders}
              tone="danger"
              styles={styles}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          {loading && !recentOrders.length ? <Text style={styles.mutedText}>Loading...</Text> : null}
          {!loading && !recentOrders.length ? (
            <Text style={styles.mutedText}>No orders yet.</Text>
          ) : null}
          {recentOrders.map((order) => (
            <View key={order.id} style={styles.listItem}>
              <View>
                <Text style={styles.listTitle}>#{order.id.slice(0, 8)}</Text>
                <Text style={styles.listMeta}>{order.customerName}</Text>
              </View>
              <View style={styles.listRight}>
                <Text style={styles.listAmount}>{formatMoney(order.total)}</Text>
                <Text style={styles.listMeta}>{order.status}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Low Stock Watch</Text>
          {loading && !lowStockProducts.length ? <Text style={styles.mutedText}>Loading...</Text> : null}
          {!loading && !lowStockProducts.length ? (
            <Text style={styles.mutedText}>No products below threshold.</Text>
          ) : null}
          {lowStockProducts.map((product) => (
            <View key={product.id} style={styles.listItem}>
              <View>
                <Text style={styles.listTitle}>{product.name}</Text>
                <Text style={styles.listMeta}>{product.merchantName}</Text>
              </View>
              <Text style={styles.criticalQty}>{product.qty} left</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Newest Accounts</Text>
          {loading && !recentUsers.length ? <Text style={styles.mutedText}>Loading...</Text> : null}
          {!loading && !recentUsers.length ? (
            <Text style={styles.mutedText}>No users yet.</Text>
          ) : null}
          {recentUsers.map((user) => (
            <View key={user.id} style={styles.listItem}>
              <Text style={styles.listTitle}>{user.name}</Text>
              <Text style={styles.listMeta}>{user.role}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <LogoutButton />
    </ScreenContainer>
  );
}

function MetricTile({ label, value, icon, styles, onPress }) {
  if (onPress) {
    return (
      <TouchableOpacity style={styles.metricTile} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.metricIconWrap}>
          <AppIcon name={icon} variant="community" size={16} color="#B3261E" />
        </View>
        <Text style={styles.metricValue}>{String(value)}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.metricTile}>
      <View style={styles.metricIconWrap}>
        <AppIcon name={icon} variant="community" size={16} color="#B3261E" />
      </View>
      <Text style={styles.metricValue}>{String(value)}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ label, value, tone, styles }) {
  const toneColor =
    tone === "success" ? "#1E8E3E" : tone === "danger" ? "#C62828" : "#EF6C00";

  return (
    <View style={styles.statusPill}>
      <Text style={[styles.statusValue, { color: toneColor }]}>{value}</Text>
      <Text style={styles.statusLabel}>{label}</Text>
    </View>
  );
}

function RevenueFlowTile({ label, value, styles }) {
  return (
    <View style={styles.revenueTile}>
      <View style={styles.revenueIconWrap}>
        <AppIcon name="cash-multiple" variant="community" size={20} color="#B3261E" />
      </View>
      <Text style={styles.revenueValue}>{value}</Text>
      <Text style={styles.revenueLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    content: {
      paddingBottom: 20,
      gap: 14,
    },
    headerCard: {
      borderRadius: 18,
      padding: 16,
      backgroundColor: "#B3261E",
    },
    headerTitle: {
      color: "#FFFFFF",
      fontSize: 24,
      fontWeight: "700",
    },
    headerSubtitle: {
      marginTop: 6,
      color: "#FCE6E4",
      fontSize: 13,
      lineHeight: 18,
    },
    card: {
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 10,
    },
    metricGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "flex-start",
    },
    metricTile: {
      width: "48%",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      backgroundColor: colors.screen,
    },
    metricIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    metricValue: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    metricLabel: {
      marginTop: 4,
      fontSize: 13,
      color: colors.textMuted,
    },
    metricRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    statusPill: {
      flex: 1,
      minWidth: 88,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 8,
      paddingHorizontal: 10,
      alignItems: "center",
      backgroundColor: colors.screen,
    },
    statusValue: {
      fontSize: 16,
      fontWeight: "700",
    },
    statusLabel: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSubtle,
    },
    revenueTile: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.screen,
      padding: 14,
    },
    revenueIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    revenueValue: {
      fontSize: 30,
      fontWeight: "700",
      color: colors.text,
    },
    revenueLabel: {
      marginTop: 6,
      fontSize: 13,
      color: colors.textSubtle,
    },
    mutedText: {
      color: colors.textSubtle,
      fontSize: 13,
    },
    listItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
    },
    listTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    listMeta: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSubtle,
      textTransform: "capitalize",
    },
    listRight: {
      alignItems: "flex-end",
    },
    listAmount: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    criticalQty: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.danger,
    },
  });
