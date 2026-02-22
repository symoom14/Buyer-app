import { useFocusEffect } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AppIcon from "../../src/components/AppIcon";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";

export default function MerchantRestock() {
  const { colors } = useAppTheme();
  const [products, setProducts] = useState([]);
  const [storeMap, setStoreMap] = useState({});
  const [orderedCounts, setOrderedCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [restockId, setRestockId] = useState(null);
  const [restockQty, setRestockQty] = useState({});
  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchProducts = async (merchantId) => {
    const q = query(
      collection(db, "products"),
      where("merchantId", "==", merchantId),
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    setProducts(list);

    const storeSnap = await getDocs(collection(db, "stores"));
    const map = {};
    storeSnap.docs.forEach((docSnap) => {
      map[docSnap.id] = docSnap.data().name;
    });
    setStoreMap(map);

    const ordersSnap = await getDocs(collection(db, "orders"));
    const counts = {};
    ordersSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      (data.items || []).forEach((item) => {
        if (!item.productId) return;
        if (item.merchantId !== merchantId) return;
        counts[item.productId] =
          (counts[item.productId] || 0) + (item.quantity || 0);
      });
    });
    setOrderedCounts(counts);
  };

  useFocusEffect(
    useCallback(() => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) fetchProducts(user.uid);
      });
      return unsub;
    }, []),
  );

  const visibleProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) => {
      const name = (product.name || "").toLowerCase();
      const storeName = (storeMap[product.storeId] || "").toLowerCase();
      return name.includes(q) || storeName.includes(q);
    });
  }, [products, storeMap, searchQuery]);

  const startRestock = (item) => {
    setRestockId(item.id);
    setRestockQty((prev) => ({
      ...prev,
      [item.id]: Math.max(prev[item.id] ?? item.quantity ?? 0, item.quantity ?? 0),
    }));
  };

  const incrementRestock = (item) => {
    setRestockQty((prev) => ({
      ...prev,
      [item.id]: (prev[item.id] ?? item.quantity ?? 0) + 1,
    }));
  };

  const confirmRestock = (item) => {
    const nextQty = restockQty[item.id];
    if (typeof nextQty === "number" && nextQty >= (item.quantity ?? 0)) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === item.id ? { ...p, quantity: nextQty } : p,
        ),
      );
    }
    setRestockId(null);
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Search by product or store"
        placeholderTextColor={colors.textSubtle}
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.search}
        clearButtonMode="while-editing"
      />

      <FlatList
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>No products found</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.left}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                Store: {storeMap[item.storeId] || "Unknown store"}
              </Text>
              <Text style={styles.meta}>Qty: {item.quantity}</Text>
              <Text style={styles.meta}>
                Ordered: {orderedCounts[item.id] || 0}
              </Text>
            </View>

            <View style={styles.right}>
              <Text
                style={[
                  styles.status,
                  item.quantity < 5
                    ? styles.statusCritical
                    : item.quantity <= 10
                      ? styles.statusLow
                      : styles.statusGood,
                ]}
              >
                {item.quantity < 5
                  ? "Restock required"
                  : item.quantity <= 10
                    ? "Low stock"
                    : "Stocked up"}
              </Text>
              {restockId === item.id ? (
                <View style={styles.restockControl}>
                  <View style={styles.qtyBox}>
                    <Text style={styles.qtyText}>
                      {restockQty[item.id] ?? item.quantity}
                    </Text>
                  </View>
                  <View style={styles.qtyActions}>
                    <View style={styles.qtyIconDisabled}>
                      <AppIcon
                        name="minus"
                        variant="community"
                        size={18}
                        color={colors.textSubtle}
                      />
                    </View>
                    <View
                      style={styles.qtyIcon}
                      onTouchEnd={() => incrementRestock(item)}
                    >
                      <AppIcon
                        name="plus"
                        variant="community"
                        size={18}
                        color={colors.success}
                      />
                    </View>
                  </View>
                  <View
                    style={styles.confirmIcon}
                    onTouchEnd={() => confirmRestock(item)}
                  >
                    <AppIcon
                      name="check-circle"
                      variant="community"
                      size={26}
                      color={colors.success}
                    />
                  </View>
                </View>
              ) : (
                <View
                  style={styles.restockIcon}
                  onTouchEnd={() => startRestock(item)}
                >
                  <AppIcon
                    name="package-variant-plus"
                    variant="community"
                    size={26}
                    color={colors.success}
                  />
                </View>
              )}
            </View>
          </View>
        )}
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
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  meta: {
    marginTop: 4,
    color: colors.textSubtle,
  },
  status: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  statusCritical: {
    color: colors.danger,
  },
  statusLow: {
    color: colors.warning,
  },
  statusGood: {
    color: colors.success,
  },
  restockIcon: {
    marginTop: 6,
  },
  restockControl: {
    marginTop: 6,
    alignItems: "flex-end",
    gap: 6,
  },
  qtyBox: {
    minWidth: 48,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  qtyText: {
    fontWeight: "600",
    fontSize: 14,
    color: colors.text,
  },
  qtyActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qtyIconDisabled: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  qtyIcon: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: colors.successSoft,
  },
  confirmIcon: {
    marginTop: 2,
  },
  empty: {
    color: colors.textSubtle,
    marginTop: 20,
  },
});
