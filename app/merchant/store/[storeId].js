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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import ScreenContainer from "../../../src/components/ScreenContainer";
import { db } from "../../../src/firebase/firebaseConfig";

export default function StorePage() {
  const { storeId } = useLocalSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState([]);

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
    <ScreenContainer>
      <Text style={styles.title}>Store Products</Text>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No products yet</Text>}
        renderItem={({ item }) => (
          <Swipeable renderRightActions={() => renderRightActions(item.id)}>
            <View style={styles.productCard}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text>
                ${item.price} · Qty: {item.quantity}
              </Text>
            </View>
          </Swipeable>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/merchant/store/add-product/${storeId}`)}
      >
        <Text style={styles.fabText}>+ Add Product</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  productCard: {
    padding: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    marginBottom: 12,
  },
  productName: {
    fontWeight: "600",
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
