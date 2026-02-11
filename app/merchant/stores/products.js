import { useFocusEffect } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db } from "../../../src/firebase/firebaseConfig";

export default function MerchantStoresProducts() {
  const [products, setProducts] = useState([]);
  const [storeMap, setStoreMap] = useState({});
  const [searchQuery, setSearchQuery] = useState("");

  const fetchProducts = async (merchantId) => {
    const q = query(
      collection(db, "products"),
      where("merchantId", "==", merchantId),
    );

    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setProducts(list);

    const storeSnap = await getDocs(collection(db, "stores"));
    const map = {};
    storeSnap.docs.forEach((docSnap) => {
      map[docSnap.id] = docSnap.data().name;
    });
    setStoreMap(map);
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All products</Text>
      <TextInput
        placeholder="Search by product or store"
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.search}
        clearButtonMode="while-editing"
      />
      <FlatList
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No products yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              Store: {storeMap[item.storeId] || "Unknown store"}
            </Text>
            <Text style={styles.meta}>
              ${item.price} · Qty: {item.quantity}
            </Text>
          </View>
        )}
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
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
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
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    marginTop: 4,
    color: "#666",
  },
  empty: {
    color: "#666",
    marginTop: 12,
  },
});
