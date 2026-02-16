import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AppIcon from "../../../src/components/AppIcon";
import { db } from "../../../src/firebase/firebaseConfig";
import { getUserDisplayName } from "../../../src/utils/userDisplayName";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const ICON_COLOR_POOL = [
  "#E53935", // red
  "#2E7D32", // green
  "#1E88E5", // blue
  "#FFA700", // chrome yellow
  "#F57C00", // orange
  "#111111", // black
];

export default function CustomerStorePage() {
  const router = useRouter();
  const { storeId } = useLocalSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const getRandomIconColor = () => {
    const idx = Math.floor(Math.random() * ICON_COLOR_POOL.length);
    return ICON_COLOR_POOL[idx];
  };

  const fetchProducts = async () => {
    try {
      const productsQuery = query(
        collection(db, "products"),
        where("storeId", "==", storeId),
        orderBy("createdAt", "desc"),
      );

      const [productSnapshot, storeSnapshot] = await Promise.all([
        getDocs(productsQuery),
        getDoc(doc(db, "stores", String(storeId))),
      ]);

      const rawProducts = productSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const storeData = storeSnapshot.exists() ? storeSnapshot.data() : {};
      const storeName = storeData?.name || "Unknown Store";

      let sellerName = "Unknown Seller";
      if (storeData?.merchantId) {
        const sellerSnapshot = await getDoc(doc(db, "users", storeData.merchantId));
        if (sellerSnapshot.exists()) {
          sellerName = getUserDisplayName(
            sellerSnapshot.data(),
            "Unknown Seller",
          );
        }
      }

      const enrichedProducts = rawProducts.map((product) => ({
        ...product,
        storeName,
        sellerName,
        iconColor: getRandomIconColor(),
      }));

      setProducts(enrichedProducts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Products</Text>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>No products in this store</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/customer/product/${item.id}`)}
          >
            <View style={styles.iconWrap}>
              <AppIcon
                name={item.iconName || DEFAULT_PRODUCT_ICON}
                variant="community"
                size={24}
                color={item.iconColor || "#333"}
              />
            </View>
            <View style={styles.contentWrap}>
              <Text style={styles.productName}>{item.name}</Text>

              <Text style={styles.meta}>
                Store: <Text style={styles.bold}>{item.storeName}</Text>
              </Text>

              <Text style={styles.meta}>
                Seller: <Text style={styles.bold}>{item.sellerName}</Text>
              </Text>

              <Text style={styles.price}>${item.price}</Text>
            </View>
          </TouchableOpacity>
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
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  contentWrap: {
    flex: 1,
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
    fontSize: 17,
    fontWeight: "600",
  },
  empty: {
    color: "#666",
    marginTop: 20,
  },
});
