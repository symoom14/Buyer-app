import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AppIcon from "../../../src/components/AppIcon";
import { useCart } from "../../../src/context/CartContext";
import { db } from "../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../src/theme/useAppTheme";
import { getUserDisplayName } from "../../../src/utils/userDisplayName";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const ICON_COLOR_POOL = [
  "#E53935", // red
  "#2E7D32", // green
  "#1E88E5", // blue
  "#FFA700", // chrome yellow
  "#F57C00", // orange
];

export default function CustomerStorePage() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { addToCart } = useCart();
  const { storeId } = useLocalSearchParams();
  const [products, setProducts] = useState([]);
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const getRandomIconColor = () => {
    const idx = Math.floor(Math.random() * ICON_COLOR_POOL.length);
    return ICON_COLOR_POOL[idx];
  };

  const fetchProducts = useCallback(async () => {
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
      setStoreName(storeData?.name || "");

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
  }, [storeId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleQuickAddToCart = (product) => {
    addToCart({
      productId: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      quantity: 1,
      storeId: product.storeId,
      storeName: product.storeName || "Unknown Store",
      merchantId: product.merchantId || "unknown",
      merchantName: product.sellerName || "Unknown Seller",
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: storeName }} />
      <Text style={styles.pageTitle}>Products</Text>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>No products in this store</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.productCardMain}
              onPress={() => router.push(`/customer/product/${item.id}`)}
            >
              <View style={styles.iconWrap}>
                <AppIcon
                  name={item.iconName || DEFAULT_PRODUCT_ICON}
                  variant="community"
                  size={24}
                  color={item.iconColor || colors.text}
                />
              </View>
                <View style={styles.contentWrap}>
                  <Text style={styles.productName}>{item.name}</Text>

                  <Text style={styles.meta}>
                    Sold by: <Text style={styles.bold}>{item.sellerName}</Text>
                  </Text>

                  <Text style={styles.price}>${item.price}</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={() => handleQuickAddToCart(item)}
            >
              <AppIcon
                name="basket-plus"
                variant="community"
                size={18}
                color="#1E8E3E"
              />
            </TouchableOpacity>
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
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 16,
    color: colors.text,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  productCardMain: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
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
    color: colors.text,
  },
  meta: {
    fontSize: 14,
    color: colors.textMuted,
  },
  bold: {
    fontWeight: "500",
  },
  price: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },
  quickAddButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  empty: {
    color: colors.textSubtle,
    marginTop: 20,
  },
});
