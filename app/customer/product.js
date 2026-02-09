import { useRouter } from "expo-router";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
} from "react-native";

import ScreenContainer from "../../src/components/ScreenContainer";
import { db } from "../../src/firebase/firebaseConfig";

export default function CustomerProducts() {
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      const productsQuery = query(
        collection(db, "products"),
        orderBy("createdAt", "desc"),
      );
      const productSnapshot = await getDocs(productsQuery);

      const rawProducts = productSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch stores
      const storeSnapshot = await getDocs(collection(db, "stores"));
      const storeMap = {};
      storeSnapshot.docs.forEach((doc) => {
        storeMap[doc.id] = doc.data().name;
      });

      // Fetch merchants
      const userSnapshot = await getDocs(collection(db, "users"));
      const merchantMap = {};
      userSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.role === "merchant") {
          merchantMap[doc.id] = data.username;
        }
      });

      const enrichedProducts = rawProducts.map((product) => ({
        ...product,
        storeName: storeMap[product.storeId] || "Unknown Store",
        sellerName: merchantMap[product.merchantId] || "Unknown Seller",
      }));

      setProducts(enrichedProducts);
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
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
      <Text style={styles.pageTitle}>Latest products in store</Text>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>No products available</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/customer/product/${item.id}`)}
          >
            <Text style={styles.productName}>{item.name}</Text>

            <Text style={styles.meta}>
              Store: <Text style={styles.bold}>{item.storeName}</Text>
            </Text>

            <Text style={styles.meta}>
              Seller: <Text style={styles.bold}>{item.sellerName}</Text>
            </Text>

            <Text style={styles.price}>${item.price}</Text>
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 16,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  meta: {
    fontSize: 14,
    color: "#555",
  },
  bold: {
    fontWeight: "500",
  },
  price: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
  },
  empty: {
    color: "#666",
    marginTop: 20,
  },
});
