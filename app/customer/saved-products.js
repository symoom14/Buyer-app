import { useFocusEffect, useRouter } from "expo-router";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import AppIcon from "../../src/components/AppIcon";
import { useCart } from "../../src/context/CartContext";
import { useFavorites } from "../../src/context/FavoritesContext";
import { db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const ICON_COLOR_POOL = [
  "#E53935",
  "#2E7D32",
  "#1E88E5",
  "#FFA700",
  "#F57C00",
  "#111111",
];

function getRandomIconColor() {
  const idx = Math.floor(Math.random() * ICON_COLOR_POOL.length);
  return ICON_COLOR_POOL[idx];
}

export default function CustomerSavedProducts() {
  const router = useRouter();
  const { favoriteIds } = useFavorites();
  const { addToCart } = useCart();
  const { colors } = useAppTheme();

  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const styles = useMemo(() => createStyles(colors), [colors]);

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

      const storeSnapshot = await getDocs(collection(db, "stores"));
      const storeMap = {};
      storeSnapshot.docs.forEach((doc) => {
        storeMap[doc.id] = doc.data().name;
      });

      const userSnapshot = await getDocs(collection(db, "users"));
      const merchantMap = {};
      userSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.role === "merchant") {
          merchantMap[doc.id] = getUserDisplayName(data, "Unknown Seller");
        }
      });

      const enrichedProducts = rawProducts.map((product) => ({
        ...product,
        storeName: storeMap[product.storeId] || "Unknown Store",
        sellerName: merchantMap[product.merchantId] || "Unknown Seller",
        iconColor: getRandomIconColor(),
      }));

      setAllProducts(enrichedProducts);
    } catch (error) {
      console.error("Error loading saved products:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, []),
  );

  const products = useMemo(() => {
    const favoritesSet = new Set(favoriteIds);
    return allProducts.filter((product) => favoritesSet.has(product.id));
  }, [allProducts, favoriteIds]);

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
      <Text style={styles.pageTitle}>Saved products</Text>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>No saved products yet</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, styles.productCard]}>
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
                  Store: <Text style={styles.bold}>{item.storeName}</Text>
                </Text>

                <Text style={styles.meta}>
                  Seller: <Text style={styles.bold}>{item.sellerName}</Text>
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
  productCard: {
    padding: 0,
  },
  productCardMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingRight: 10,
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
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 16,
    color: colors.text,
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
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
    backgroundColor: colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    color: colors.textSubtle,
    marginTop: 20,
  },
});
