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
import {
  formatSelectedOptionsLabel,
  getDefaultSelectedOptions,
  resolveVariantUnitPrice,
} from "../../../src/utils/productVariants";
import { fetchProductRatingSummaryMap } from "../../../src/utils/reviews";
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
      const productRatingsMap = await fetchProductRatingSummaryMap(
        db,
        rawProducts.map((product) => product.id),
      );

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

      const enrichedProducts = rawProducts.map((product) => {
        const ratingSummary = productRatingsMap[product.id] || {
          average: 0,
          count: 0,
        };
        return {
          ...product,
          storeName,
          sellerName,
          iconColor: getRandomIconColor(),
          ratingAverage: Number(ratingSummary.average || 0),
          ratingCount: Number(ratingSummary.count || 0),
        };
      });

      setProducts(enrichedProducts);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleQuickAddToCart = (product) => {
    const selectedOptions = getDefaultSelectedOptions(product.variantGroups);
    const resolvedPrice = resolveVariantUnitPrice(
      Number(product.price) || 0,
      product.variants,
      selectedOptions,
    );
    addToCart({
      productId: product.id,
      name: product.name,
      price: Number(resolvedPrice) || 0,
      quantity: 1,
      storeId: product.storeId,
      storeName: product.storeName || "Unknown Store",
      merchantId: product.merchantId || "unknown",
      merchantName: product.sellerName || "Unknown Seller",
      iconName: product.iconName || DEFAULT_PRODUCT_ICON,
      selectedOptions,
      selectedOptionsLabel: formatSelectedOptionsLabel(
        selectedOptions,
        product.variantGroups,
      ),
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
                <View style={styles.metaWrap}>
                  <Text style={styles.sellerStoreText}>{item.sellerName}</Text>
                </View>
                <Text style={styles.productName}>{item.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>${Number(item.price || 0).toFixed(2)}</Text>
                  <View style={styles.ratingPill}>
                    <AppIcon
                      name={
                        Number(item.ratingCount || 0) > 0
                          ? "star"
                          : "star-settings-outline"
                      }
                      variant="community"
                      size={12}
                      color="#F4B400"
                    />
                    <Text style={styles.ratingPillText}>
                      {Number(item.ratingCount || 0) > 0
                        ? `${Number(item.ratingAverage || 0).toFixed(1)} (${Number(
                            item.ratingCount || 0,
                          )})`
                        : "0"}
                    </Text>
                  </View>
                </View>
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
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  productCard: {
    padding: 0,
  },
  productCardMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingRight: 8,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  contentWrap: {
    flex: 1,
  },
  metaWrap: {
    marginTop: 2,
    marginBottom: 4,
  },
  sellerStoreText: {
    fontSize: 12,
    color: colors.textSubtle,
    fontWeight: "500",
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
    color: colors.text,
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  priceRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  ratingPill: {
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingPillText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
  },
  quickAddButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
    backgroundColor: colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    color: colors.textSubtle,
    marginTop: 20,
  },
});
