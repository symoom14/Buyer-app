import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { db } from "../../../src/firebase/firebaseConfig";

export default function StorePage() {
  const { storeId } = useLocalSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [soldCounts, setSoldCounts] = useState({});

  const fetchProducts = async () => {
    const q = query(
      collection(db, "products"),
      where("storeId", "==", storeId),
    );

    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setProducts(list);

    const orderSnap = await getDocs(collection(db, "orders"));
    const counts = {};
    orderSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      (data.items || []).forEach((item) => {
        if (!item.productId) return;
        counts[item.productId] =
          (counts[item.productId] || 0) + (item.quantity || 0);
      });
    });
    setSoldCounts(counts);
  };

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, []),
  );

  const handleDelete = async (productId) => {
    await deleteDoc(doc(db, "products", productId));
    fetchProducts();
  };

  const renderRightActions = (productId) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => handleDelete(productId)}
    >
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Store Products</Text>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No products yet</Text>}
        renderItem={({ item }) => (
          <Swipeable renderRightActions={() => renderRightActions(item.id)}>
            <Pressable
              style={styles.productCard}
              onPress={() =>
                router.push(`/merchant/store/edit-product/${item.id}`)
              }
            >
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productMeta}>
                ${item.price} · Qty: {item.quantity}
              </Text>
              <Text style={styles.productMeta}>
                Ordered: {soldCounts[item.id] || 0}
              </Text>
              <Text
                style={[
                  styles.stockStatus,
                  item.quantity < 5
                    ? styles.stockCritical
                    : item.quantity <= 10
                      ? styles.stockLow
                      : styles.stockGood,
                ]}
              >
                {item.quantity < 5
                  ? "Restock required!"
                  : item.quantity <= 10
                    ? "Low stock"
                    : "Stocked up"}
              </Text>
            </Pressable>
          </Swipeable>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/merchant/store/add-product/${storeId}`)}
      >
        <Text style={styles.fabText}>+ Add Product</Text>
      </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  productCard: {
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
  },
  productName: {
    fontWeight: "600",
    fontSize: 16,
  },
  productMeta: {
    marginTop: 4,
    color: "#555",
  },
  stockStatus: {
    marginTop: 6,
    fontWeight: "600",
  },
  stockCritical: {
    color: "#C62828",
  },
  stockLow: {
    color: "#EF6C00",
  },
  stockGood: {
    color: "#2E7D32",
  },
  empty: {
    color: "#666",
    marginTop: 12,
  },
  deleteButton: {
    backgroundColor: "#e53935",
    justifyContent: "center",
    alignItems: "center",
    width: 96,
    marginBottom: 12,
    borderRadius: 8,
  },
  deleteText: {
    color: "#fff",
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    backgroundColor: "#000",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 5,
  },
  fabText: {
    color: "#fff",
    fontWeight: "600",
  },
});
