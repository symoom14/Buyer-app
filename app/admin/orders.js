import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AppIcon from "../../src/components/AppIcon";
import ScreenContainer from "../../src/components/ScreenContainer";
import { db } from "../../src/firebase/firebaseConfig";
import { getStatusColors } from "../../src/theme/statusPalette";
import { useAppTheme } from "../../src/theme/useAppTheme";

const toDate = (value) => {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(0);
};

const toCurrency = (value) =>
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
    (sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );
};

const limitMatches = (list, max = 8) => list.slice(0, max);
const summarizeList = (items, max = 3) => {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return "—";
  if (clean.length <= max) return clean.join(" • ");
  return `${clean.slice(0, max).join(" • ")} +${clean.length - max} more`;
};
const summarizeItemLines = (items, max = 4) => {
  const cleaned = items.filter(Boolean);
  if (cleaned.length === 0) return "—";
  const lines = cleaned.map((item) => `${item.name} (x${item.quantity})`);
  if (lines.length <= max) return lines.join(" • ");
  return `${lines.slice(0, max).join(" • ")} +${lines.length - max} more`;
};
const STATUS_ICONS = {
  pending: "receipt-clock",
  accepted: "receipt-text-arrow-right",
  completed: "receipt-text-check",
  cancelled: "close-box",
};

const getStatusBackgroundColor = (status, isDark) => {
  if (status === "pending") return isDark ? "#4A3B17" : "#FFF4CC";
  if (status === "accepted") return isDark ? "#1D344D" : "#DDEEFF";
  if (status === "completed") return isDark ? "#1F3D2A" : "#DFF7E6";
  if (status === "cancelled") return isDark ? "#4D2424" : "#FFE0E0";
  return isDark ? "#2A2E33" : "#E5E5EA";
};

export default function AdminOrdersScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusColors = useMemo(
    () => getStatusColors(colors, isDark),
    [colors, isDark],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [orders, setOrders] = useState([]);
  const [userNameById, setUserNameById] = useState({});
  const [storeNameById, setStoreNameById] = useState({});
  const [productById, setProductById] = useState({});

  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
      const rows = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
      setOrders(rows);
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const map = {};
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        map[docSnap.id] = data?.name || data?.username || "Unknown user";
      });
      setUserNameById(map);
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
          storeId: docSnap.data()?.storeId || "",
          name: docSnap.data()?.name || "",
        };
      });
      setProductById(map);
    });

    return () => {
      unsubOrders();
      unsubUsers();
      unsubStores();
      unsubProducts();
    };
  }, []);

  const mappedOrders = useMemo(
    () =>
      orders.map((order) => {
        const items = Array.isArray(order.items) ? order.items : [];

        const customerName = userNameById[order.customerId] || "Unknown customer";

        const sellerNames = [
          ...new Set(
            items
              .map(
                (item) =>
                  userNameById[item.merchantId] || item.merchantName || "Unknown seller",
              )
              .filter(Boolean),
          ),
        ];

        const itemCountMap = new Map();
        items.forEach((item) => {
          const name = item.name || productById[item.productId]?.name || "";
          if (!name) return;
          const nextQty = (itemCountMap.get(name) || 0) + Number(item.quantity || 0);
          itemCountMap.set(name, nextQty);
        });
        const itemLines = Array.from(itemCountMap.entries()).map(([name, quantity]) => ({
          name,
          quantity,
        }));
        const itemNames = itemLines.map((entry) => entry.name);

        const storeNames = [
          ...new Set(
            items
              .map((item) => {
                const storeId = productById[item.productId]?.storeId;
                return storeNameById[storeId] || "";
              })
              .filter(Boolean),
          ),
        ];

        return {
          id: order.id,
          createdAt: toDate(order.createdAt),
          status: order.status || "pending",
          total: formatOrderTotal(order),
          customerName,
          sellerNames,
          itemNames,
          itemLines,
          storeNames,
          itemsCount: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        };
      }),
    [orders, productById, storeNameById, userNameById],
  );

  const visibleOrders = useMemo(() => {
    const byStatus =
      selectedStatus === "all"
        ? mappedOrders
        : mappedOrders.filter((order) => order.status === selectedStatus);

    const q = searchQuery.trim().toLowerCase();
    if (!q) return byStatus;

    return byStatus.filter((order) => {
      const customerHit = order.customerName.toLowerCase().includes(q);
      const sellerHit = order.sellerNames.some((name) => name.toLowerCase().includes(q));
      const itemHit = order.itemNames.some((name) => name.toLowerCase().includes(q));
      const storeHit = order.storeNames.some((name) => name.toLowerCase().includes(q));
      return customerHit || sellerHit || itemHit || storeHit || order.id.toLowerCase().includes(q);
    });
  }, [mappedOrders, searchQuery, selectedStatus]);

  const statusFilters = [
    { key: "all", label: "All", light: "#E5E5EA", dark: "#6E6E73" },
    { key: "pending", label: "Pending", light: "#FFF4CC", dark: "#B38300" },
    { key: "accepted", label: "Accepted", light: "#DDEEFF", dark: "#0B5ED7" },
    { key: "completed", label: "Completed", light: "#DFF7E6", dark: "#1E8E3E" },
    { key: "cancelled", label: "Cancelled", light: "#FFE0E0", dark: "#C62828" },
  ];

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        customers: [],
        sellers: [],
        items: [],
        stores: [],
      };
    }

    const customers = limitMatches(
      [...new Set(visibleOrders.map((order) => order.customerName))].filter((name) =>
        name.toLowerCase().includes(q),
      ),
    );

    const sellers = limitMatches(
      [...new Set(visibleOrders.flatMap((order) => order.sellerNames))].filter((name) =>
        name.toLowerCase().includes(q),
      ),
    );

    const items = limitMatches(
      [...new Set(visibleOrders.flatMap((order) => order.itemNames))].filter((name) =>
        name.toLowerCase().includes(q),
      ),
    );

    const stores = limitMatches(
      [...new Set(visibleOrders.flatMap((order) => order.storeNames))].filter((name) =>
        name.toLowerCase().includes(q),
      ),
    );

    return { customers, sellers, items, stores };
  }, [searchQuery, visibleOrders]);

  return (
    <ScreenContainer disableBottomInset bottomPadding={12}>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search by customer, seller, item, or store"
        placeholderTextColor={colors.textSubtle}
        style={styles.searchInput}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
      <View style={styles.filters}>
        {statusFilters.map((filter) => {
          const isSelected = selectedStatus === filter.key;
          return (
            <Pressable
              key={filter.key}
              style={[
                styles.filterPill,
                !isSelected && {
                  backgroundColor: filter.light,
                  borderColor: "transparent",
                },
                isSelected && {
                  backgroundColor: filter.dark,
                  borderColor: filter.light,
                },
              ]}
              onPress={() => setSelectedStatus(filter.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  !isSelected && { color: filter.dark },
                  isSelected && { color: colors.background },
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {searchQuery.trim().length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Search Breakdown</Text>
            <MatchRow title="Customers" values={searchMatches.customers} styles={styles} />
            <MatchRow title="Sellers" values={searchMatches.sellers} styles={styles} />
            <MatchRow title="Items" values={searchMatches.items} styles={styles} />
            <MatchRow title="Stores" values={searchMatches.stores} styles={styles} />
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Orders ({visibleOrders.length})</Text>

          {visibleOrders.length === 0 ? (
            <Text style={styles.emptyText}>No orders found.</Text>
          ) : null}

          {visibleOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
                <View
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: getStatusBackgroundColor(order.status, isDark),
                      borderColor: statusColors[order.status] || statusColors.pending,
                    },
                  ]}
                >
                  <AppIcon
                    name={STATUS_ICONS[order.status] || STATUS_ICONS.pending}
                    variant="community"
                    size={13}
                    color={statusColors[order.status] || statusColors.pending}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: statusColors[order.status] || statusColors.pending },
                    ]}
                  >
                    {order.status}
                  </Text>
                </View>
              </View>

              <MetaRow
                label="Customer"
                value={order.customerName}
                styles={styles}
              />
              <MetaRow
                label="Sellers"
                value={summarizeList(order.sellerNames)}
                count={order.sellerNames.length}
                styles={styles}
              />
              <MetaRow
                label="Stores"
                value={summarizeList(order.storeNames)}
                count={order.storeNames.length}
                styles={styles}
              />
              <MetaRow
                label="Items"
                value={summarizeItemLines(order.itemLines, 4)}
                styles={styles}
              />

              <View style={styles.orderFooter}>
                <Text style={styles.footerMeta}>Qty {order.itemsCount}</Text>
                <Text style={styles.total}>{toCurrency(order.total)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function MatchRow({ title, values, styles }) {
  return (
    <View style={styles.matchRow}>
      <Text style={styles.matchTitle}>{title}</Text>
      <View style={styles.matchWrap}>
        {values.length === 0 ? (
          <Text style={styles.matchEmpty}>No matches</Text>
        ) : null}
        {values.map((value) => (
          <View key={`${title}-${value}`} style={styles.matchChip}>
            <Text style={styles.matchText}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MetaRow({ label, value, count, styles }) {
  const hasCount = Number.isFinite(count);
  const labelText = hasCount ? `${label} (${count})` : label;
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{labelText}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    searchInput: {
      backgroundColor: colors.input,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      marginBottom: 12,
    },
    content: {
      gap: 12,
      paddingBottom: 8,
    },
    filters: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    filterPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    filterText: {
      fontSize: 12,
      fontWeight: "600",
    },
    sectionCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 10,
    },
    matchRow: {
      marginBottom: 8,
    },
    matchTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
      marginBottom: 6,
    },
    matchWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    matchChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.screen,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    matchText: {
      fontSize: 12,
      color: colors.text,
    },
    matchEmpty: {
      fontSize: 12,
      color: colors.textSubtle,
    },
    emptyText: {
      marginTop: 4,
      color: colors.textSubtle,
      fontSize: 13,
      textAlign: "center",
    },
    orderCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.screen,
      padding: 10,
      marginBottom: 8,
    },
    orderHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    orderId: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: colors.surface,
    },
    statusText: {
      fontSize: 11,
      color: colors.textMuted,
      textTransform: "capitalize",
    },
    meta: {
      fontSize: 12,
      color: colors.textSubtle,
      marginTop: 2,
    },
    metaRow: {
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
    },
    metaLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    metaValue: {
      marginTop: 4,
      fontSize: 12,
      color: colors.text,
      lineHeight: 17,
    },
    orderFooter: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    footerMeta: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "600",
    },
    total: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
  });
