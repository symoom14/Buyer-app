import { useLocalSearchParams } from "expo-router";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text } from "react-native";
import ScreenContainer from "../../../src/components/ScreenContainer";
import { db } from "../../../src/firebase/firebaseConfig";

export default function CustomerStorePage() {
  const { storeId } = useLocalSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    const q = query(
      collection(db, "products"),
      where("storeId", "==", storeId),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setProducts(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size="large" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Products</Text>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>No products in this store</Text>
        }
        renderItem={({ item }) => (
          <Text style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            {"\n"}${item.price} · Qty: {item.quantity}
          </Text>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  name: {
    fontWeight: "600",
    fontSize: 16,
  },
  empty: {
    color: "#666",
    marginTop: 20,
  },
});
