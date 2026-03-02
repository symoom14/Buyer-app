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
import {
  formatSelectedOptionsLabel,
  getDefaultSelectedOptions,
  resolveVariantUnitPrice,
} from "../../src/utils/productVariants";
import { fetchProductRatingSummaryMap } from "../../src/utils/reviews";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const ICON_COLOR_POOL = [
  "#E53935",
  "#2E7D32",
  "#1E88E5",
  "#FFA700",
  "#F57C00",
];

function getRandomIconColor() {
  const idx = Math.floor(Math.random() * ICON_COLOR_POOL.length);
  return ICON_COLOR_POOL[idx];
}

function toHexChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
}

function getLightIconBackground(iconColor, fallbackColor) {
  if (typeof iconColor !== "string" || !iconColor.startsWith("#")) {
    return fallbackColor;
  }

  const compactHex = iconColor.slice(1);
  const fullHex =
    compactHex.length === 3
      ? compactHex
          .split("")
          .map((ch) => `${ch}${ch}`)
          .join("")
      : compactHex;

  if (fullHex.length !== 6) return fallbackColor;

  const r = parseInt(fullHex.slice(0, 2), 16);
  const g = parseInt(fullHex.slice(2, 4), 16);
  const b = parseInt(fullHex.slice(4, 6), 16);

  if ([r, g, b].every((channel) => channel <= 30)) {
    return "#E5E7EB";
  }

  const mix = 0.78;
  const bgR = r + (255 - r) * mix;
  const bgG = g + (255 - g) * mix;
  const bgB = b + (255 - b) * mix;

  return `#${toHexChannel(bgR)}${toHexChannel(bgG)}${toHexChannel(bgB)}`;
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
      const productRatingsMap = await fetchProductRatingSummaryMap(
        db,
        rawProducts.map((product) => product.id),
      );

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

      const enrichedProducts = rawProducts.map((product) => {
        const ratingSummary = productRatingsMap[product.id] || {
          average: 0,
          count: 0,
        };
        return {
          ...product,
          storeName: storeMap[product.storeId] || "Unknown Store",
          sellerName: merchantMap[product.merchantId] || "Unknown Seller",
          iconColor: getRandomIconColor(),
          ratingAverage: Number(ratingSummary.average || 0),
          ratingCount: Number(ratingSummary.count || 0),
        };
      });

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
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: getLightIconBackground(
                      item.iconColor,
                      colors.surfaceMuted,
                    ),
                  },
                ]}
              >
                <AppIcon
                  name={item.iconName || DEFAULT_PRODUCT_ICON}
                  variant="community"
                  size={27}
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
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 12,
    color: colors.text,
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
    color: colors.text,
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
