import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AppIcon from "../../src/components/AppIcon";
import EmptyFieldState from "../../src/components/EmptyFieldState";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { getStatusColors } from "../../src/theme/statusPalette";
import { useAppTheme } from "../../src/theme/useAppTheme";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

const STATUS_ICONS = {
  pending: "receipt-clock",
  accepted: "receipt-text-arrow-right",
  completed: "receipt-text-check",
  cancelled: "close-box",
};

export default function MerchantOrdersScreen() {
  const params = useLocalSearchParams();
  const [orders, setOrders] = useState([]);
  const [userCache, setUserCache] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [error, setError] = useState("");
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusColors = useMemo(
    () => getStatusColors(colors, isDark),
    [colors, isDark],
  );

  useEffect(() => {
    const rawStatus = Array.isArray(params?.status)
      ? params.status[0]
      : params?.status;
    const validStatuses = new Set([
      "all",
      "pending",
      "accepted",
      "completed",
      "cancelled",
    ]);
    if (typeof rawStatus === "string" && validStatuses.has(rawStatus)) {
      setSelectedStatus(rawStatus);
    }
  }, [params?.status]);

  const fetchOrders = useCallback(async (merchantId) => {
    try {
      setError("");

      const snapshot = await getDocs(collection(db, "orders"));

      const filteredOrders = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();

          const merchantItems = data.items?.filter(
            (item) => item.merchantId === merchantId,
          );

          if (!merchantItems || merchantItems.length === 0) return null;

          const totalItems = merchantItems.reduce(
            (sum, item) => sum + (item.quantity || 0),
            0,
          );
          const merchantTotal = merchantItems.reduce(
            (sum, item) =>
              sum + Number(item.price || 0) * Number(item.quantity || 0),
            0,
          );

          return {
            id: docSnap.id,
            createdAt: data.createdAt,
            total: merchantTotal,
            customerId: data.customerId,
            totalItems,
            status: data.status || "pending",
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

      setOrders(filteredOrders);

      const uniqueCustomerIds = [
        ...new Set(filteredOrders.map((o) => o.customerId)),
      ];

      const fetchedCache = {};

      await Promise.all(
        uniqueCustomerIds.map(async (id) => {
          const userSnap = await getDoc(doc(db, "users", id));
          if (userSnap.exists()) {
            fetchedCache[id] = getUserDisplayName(
              userSnap.data(),
              "Unknown user",
            );
          } else {
            fetchedCache[id] = "Unknown user";
          }
        }),
      );

      setUserCache((prev) => ({ ...prev, ...fetchedCache }));
    } catch (_err) {
      setError("Failed to load orders.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!user) {
          setOrders([]);
          setError("Please sign in to view orders.");
          return;
        }

        fetchOrders(user.uid);
      });

      return unsubscribe;
    }, [fetchOrders]),
  );

  const visibleOrders = useMemo(() => {
    const filteredByStatus =
      selectedStatus === "all"
        ? orders
        : orders.filter((order) => order.status === selectedStatus);

    if (!searchQuery.trim()) return filteredByStatus;

    const q = searchQuery.toLowerCase();

    return filteredByStatus.filter((order) => {
      const customerName = userCache[order.customerId] || "";
      return customerName.toLowerCase().includes(q);
    });
  }, [orders, selectedStatus, userCache, searchQuery]);

  const statusFilters = [
    {
      key: "all",
      label: "All",
      light: "#E5E5EA",
      dark: "#6E6E73",
    },
    {
      key: "pending",
      label: "Pending",
      light: "#FFF4CC",
      dark: "#B38300",
    },
    {
      key: "accepted",
      label: "Accepted",
      light: "#DDEEFF",
      dark: "#0B5ED7",
    },
    {
      key: "completed",
      label: "Completed",
      light: "#DFF7E6",
      dark: "#1E8E3E",
    },
    {
      key: "cancelled",
      label: "Cancelled",
      light: "#FFE0E0",
      dark: "#C62828",
    },
  ];

  const isOnboardingEmpty =
    !error && !searchQuery.trim() && orders.length === 0;

  const renderItem = ({ item }) => {
    const date = item.createdAt?.toDate?.();

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/merchant/orders/${item.id}`)}
      >
        <View style={styles.left}>
          <Text style={styles.date}>
            {date ? date.toLocaleString() : "Unknown date"}
          </Text>

          <Text style={styles.meta}>
            Customer: {userCache[item.customerId] || "Loading…"}
          </Text>

          <Text style={styles.meta}>Order ID: {item.id}</Text>
          <Text style={styles.meta}>Items: {item.totalItems}</Text>
        </View>

        <View style={styles.right}>
          <AppIcon
            name={STATUS_ICONS[item.status]}
            variant="community"
            size={26}
            color={statusColors[item.status] || statusColors.pending}
          />

          <Text style={styles.price}>${item.total?.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Search by customer"
        placeholderTextColor={colors.textSubtle}
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.search}
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

      <FlatList
        data={visibleOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          visibleOrders.length === 0 ? styles.listEmptyContainer : undefined
        }
        ListEmptyComponent={
          isOnboardingEmpty ? (
            <EmptyFieldState message="Empty as a field. Create a new store to start selling!" />
          ) : (
            <Text style={styles.empty}>{error || "No orders found"}</Text>
          )
        }
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
    search: {
      backgroundColor: colors.input,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      marginBottom: 12,
      color: colors.text,
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
    card: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      padding: 14,
      borderRadius: 14,
      marginBottom: 12,
    },
    left: {
      flexShrink: 1,
    },
    right: {
      justifyContent: "center",
      alignItems: "flex-end",
      gap: 6,
    },
    date: {
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 4,
      color: colors.text,
    },
    meta: {
      fontSize: 13,
      color: colors.textMuted,
    },
    price: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    empty: {
      textAlign: "center",
      color: colors.textSubtle,
      marginTop: 40,
    },
    listEmptyContainer: {
      flexGrow: 1,
    },
  });
