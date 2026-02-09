import { useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { auth, db } from "../../src/firebase/firebaseConfig";

export default function MerchantOrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [userCache, setUserCache] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const fetchOrders = async (merchantId) => {
    try {
      setError("");

      // Get all orders
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

          return {
            id: docSnap.id,
            createdAt: data.createdAt,
            total: data.total,
            customerId: data.customerId,
            totalItems,
          };
        })
        .filter(Boolean)
        // Sort newest → oldest
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

      setOrders(filteredOrders);

      // Resolve customer usernames
      const uniqueCustomerIds = [
        ...new Set(filteredOrders.map((o) => o.customerId)),
      ];

      const newCache = { ...userCache };

      await Promise.all(
        uniqueCustomerIds.map(async (id) => {
          if (newCache[id]) return;

          const userSnap = await getDoc(doc(db, "users", id));
          if (userSnap.exists()) {
            newCache[id] = userSnap.data().username || "Unknown user";
          } else {
            newCache[id] = "Unknown user";
          }
        }),
      );

      setUserCache(newCache);
    } catch (err) {
      setError("Failed to load orders.");
    }
  };

  // Refresh every time screen gains focus
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
    }, []),
  );

  // Search filtering (by customer username)
  const visibleOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;

    const q = searchQuery.toLowerCase();

    return orders.filter((order) => {
      const username = userCache[order.customerId] || "";
      return username.toLowerCase().includes(q);
    });
  }, [orders, userCache, searchQuery]);

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
          <Text style={styles.price}>${item.total?.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Search by customer"
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.search}
        clearButtonMode="while-editing"
      />

      <FlatList
        data={visibleOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>{error || "No orders found"}</Text>
        }
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
  search: {
    backgroundColor: "#E5E5EA",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 12,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
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
  },
  date: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: "#555",
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
  },
  empty: {
    textAlign: "center",
    color: "#666",
    marginTop: 40,
  },
});
