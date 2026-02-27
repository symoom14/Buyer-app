import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AppIcon from "../../src/components/AppIcon";
import { useCart } from "../../src/context/CartContext";
import { useFavorites } from "../../src/context/FavoritesContext";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";
import {
  PRODUCT_SORT_MODES,
  sortProducts,
} from "../../src/utils/productSorting";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const ICON_COLOR_POOL = [
  "#E53935", // red
  "#2E7D32", // green
  "#1E88E5", // blue
  "#FFA700", // chrome yellow
  "#F57C00", // orange
];

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

  const mix = 0.78; // blend toward white for a soft pastel tint
  const bgR = r + (255 - r) * mix;
  const bgG = g + (255 - g) * mix;
  const bgB = b + (255 - b) * mix;

  return `#${toHexChannel(bgR)}${toHexChannel(bgG)}${toHexChannel(bgB)}`;
}

export default function CustomerProducts() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { addToCart } = useCart();
  const { hasFavoriteStore, toggleFavoriteStore } = useFavorites();
  const { colors, isDark } = useAppTheme();

  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [pastOrderProducts, setPastOrderProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  const getRandomIconColor = useCallback(() => {
    const idx = Math.floor(Math.random() * ICON_COLOR_POOL.length);
    return ICON_COLOR_POOL[idx];
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const productsQuery = query(
        collection(db, "products"),
        orderBy("createdAt", "desc"),
      );
      const [productSnapshot, storeSnapshot, userSnapshot, orderSnapshot] =
        await Promise.all([
          getDocs(productsQuery),
          getDocs(collection(db, "stores")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "orders")),
        ]);

      const rawProducts = productSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const storeMap = {};
      const storeMerchantMap = {};
      const storeList = [];
      storeSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        storeMap[doc.id] = data.name;
        storeMerchantMap[doc.id] = data.merchantId || "";
        storeList.push({
          id: doc.id,
          name: data.name || "Unknown Store",
          merchantId: data.merchantId || "",
        });
      });
      setStores(storeList);

      const merchantMap = {};
      const merchantList = [];
      userSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const sellerName = getUserDisplayName(data, "Unknown Seller");
        merchantMap[doc.id] = sellerName;
        if (data.role === "merchant") {
          merchantMap[doc.id] = sellerName;
          merchantList.push({
            id: doc.id,
            name: sellerName,
          });
        }
      });
      setSellers(merchantList);

      const enrichedProducts = rawProducts.map((product) => {
        const ownerMerchantId = storeMerchantMap[product.storeId] || "";
        const resolvedMerchantId = ownerMerchantId || product.merchantId || "";
        return {
          ...product,
          merchantId: resolvedMerchantId,
          storeName: storeMap[product.storeId] || "Unknown Store",
          sellerName:
            merchantMap[resolvedMerchantId] ||
            product.sellerName ||
            product.merchantName ||
            "Unknown Seller",
          iconColor: getRandomIconColor(),
        };
      });

      setProducts(enrichedProducts);

      const customerId = auth.currentUser?.uid;
      if (!customerId) {
        setPastOrderProducts([]);
      } else {
        const orderProductRows = orderSnapshot.docs
          .flatMap((docSnap) => {
            const data = docSnap.data();
            if (data.customerId !== customerId) return [];

            return (data.items || []).map((item, idx) => ({
              id: `${docSnap.id}:${item.merchantId || "unknown"}:${idx}`,
              orderId: docSnap.id,
              merchantId: item.merchantId || "unknown",
              merchantName:
                merchantMap[item.merchantId] ||
                item.merchantName ||
                item.sellerName ||
                "Unknown Seller",
              productName: item.name || "Unknown product",
              quantity: Number(item.quantity || 0),
              price: Number(item.price || 0),
              createdAt: data.createdAt?.toDate?.() || new Date(0),
              status:
                data.merchantStatuses?.[item.merchantId]?.status || "pending",
            }));
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setPastOrderProducts(orderProductRows);
      }
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
  }, [getRandomIconColor]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const raw = Array.isArray(params?.q) ? params.q[0] : params?.q;
    if (typeof raw !== "string") return;
    setSearchQuery(raw);
  }, [params?.q]);

  const masterMaxPrice = useMemo(() => {
    const raw = Array.isArray(params?.maxPrice)
      ? params.maxPrice[0]
      : params?.maxPrice;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [params?.maxPrice]);

  const masterFilteredProducts = useMemo(() => {
    if (masterMaxPrice == null) return products;
    return products.filter((p) => Number(p.price || 0) <= masterMaxPrice);
  }, [masterMaxPrice, products]);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  const categoryOptions = useMemo(() => {
    const unique = new Set(
      masterFilteredProducts
        .map((p) => String(p.category || "").trim())
        .filter(Boolean),
    );
    return ["All", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [masterFilteredProducts]);

  const categoryFilteredProducts = useMemo(() => {
    if (selectedCategory === "All") return masterFilteredProducts;
    return masterFilteredProducts.filter(
      (p) => p.category === selectedCategory,
    );
  }, [masterFilteredProducts, selectedCategory]);

  const sortedCategoryProducts = useMemo(
    () =>
      sortProducts(categoryFilteredProducts, PRODUCT_SORT_MODES.RECOMMENDED),
    [categoryFilteredProducts],
  );

  const productResults = useMemo(() => {
    if (!isSearching) return [];
    return sortProducts(
      categoryFilteredProducts.filter((product) => {
        const productName = (product.name || "").toLowerCase();
        return productName.includes(trimmedQuery);
      }),
      PRODUCT_SORT_MODES.RECOMMENDED,
    );
  }, [categoryFilteredProducts, isSearching, trimmedQuery]);
  const overBudgetProductResults = useMemo(() => {
    if (!isSearching || masterMaxPrice == null) return [];
    return sortProducts(
      products.filter((product) => {
        const productName = (product.name || "").toLowerCase();
        const price = Number(product.price || 0);
        return productName.includes(trimmedQuery) && price > masterMaxPrice;
      }),
      PRODUCT_SORT_MODES.RECOMMENDED,
    );
  }, [isSearching, masterMaxPrice, products, trimmedQuery]);

  const storeResults = useMemo(() => {
    if (!isSearching) return [];
    return stores.filter((store) =>
      (store.name || "").toLowerCase().includes(trimmedQuery),
    );
  }, [isSearching, stores, trimmedQuery]);

  const sellerResults = useMemo(() => {
    if (!isSearching) return [];
    return sellers.filter((seller) =>
      (seller.name || "").toLowerCase().includes(trimmedQuery),
    );
  }, [isSearching, sellers, trimmedQuery]);
  const pastOrderProductResults = useMemo(() => {
    if (!isSearching) return [];
    return pastOrderProducts.filter((row) =>
      (row.productName || "").toLowerCase().includes(trimmedQuery),
    );
  }, [isSearching, pastOrderProducts, trimmedQuery]);
  const searchSections = useMemo(() => {
    if (!isSearching) return [];
    if (masterMaxPrice != null) {
      return [
        { key: "products", title: "Products", items: productResults },
        {
          key: "over-budget-products",
          title: `Products above $${masterMaxPrice}`,
          items: overBudgetProductResults,
        },
        {
          key: "past-order-products",
          title: "Product matches in past orders",
          items: pastOrderProductResults,
        },
      ];
    }
    return [
      { key: "products", title: "Products", items: productResults },
      { key: "stores", title: "Stores", items: storeResults },
      { key: "sellers", title: "Sellers", items: sellerResults },
      {
        key: "past-order-products",
        title: "Product matches in past orders",
        items: pastOrderProductResults,
      },
    ];
  }, [
    isSearching,
    masterMaxPrice,
    overBudgetProductResults,
    pastOrderProductResults,
    productResults,
    sellerResults,
    storeResults,
  ]);
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  const renderProductCard = (product, key, options = {}) => {
    const { showCategoryBadge = false } = options;
    const categoryLabel =
      String(product.category || "").trim() || "Uncategorized";
    return (
      <View key={key} style={[styles.card, styles.productCard]}>
        <TouchableOpacity
          style={styles.productCardMain}
          onPress={() => router.push(`/customer/product/${product.id}`)}
        >
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: getLightIconBackground(
                  product.iconColor,
                  colors.surfaceMuted,
                ),
              },
            ]}
          >
            <AppIcon
              name={product.iconName || DEFAULT_PRODUCT_ICON}
              variant="community"
              size={27}
              color={product.iconColor || (isDark ? colors.textMuted : "#333")}
            />
          </View>

          <View style={styles.contentWrap}>
            <View style={styles.metaWrap}>
              <Text style={styles.sellerStoreText}>{product.sellerName}</Text>
            </View>
            <Text style={styles.productName}>{product.name}</Text>
            {showCategoryBadge ? (
              <View style={styles.resultCategoryBadge}>
                <Text style={styles.resultCategoryBadgeText}>
                  {categoryLabel}
                </Text>
              </View>
            ) : null}

            <Text style={styles.price}>${product.price}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAddButton}
          onPress={() => handleQuickAddToCart(product)}
        >
          <AppIcon
            name="basket-plus"
            variant="community"
            size={18}
            color="#1E8E3E"
          />
        </TouchableOpacity>
      </View>
    );
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
      <TextInput
        style={styles.search}
        placeholder="Search products, stores, sellers"
        placeholderTextColor={colors.textSubtle}
        value={searchQuery}
        onChangeText={setSearchQuery}
        clearButtonMode="while-editing"
      />
      {!isSearching ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filters}
        >
          {categoryOptions.map((category) => {
            const isSelected = category === selectedCategory;
            const isAll = category === "All";
            return (
              <TouchableOpacity
                key={category}
                onPress={() => setSelectedCategory(category)}
                activeOpacity={1}
                style={[
                  styles.categoryPill,
                  isAll
                    ? isSelected
                      ? styles.categoryAllPillSelected
                      : styles.categoryAllPill
                    : isSelected
                      ? styles.categoryPillSelected
                      : null,
                ]}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    isAll
                      ? isSelected
                        ? styles.categoryAllPillTextSelected
                        : styles.categoryAllPillText
                      : isSelected
                        ? styles.categoryPillTextSelected
                        : null,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {isSearching ? (
        <FlatList
          data={searchSections}
          keyExtractor={(item) => item.key}
          centerContent={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<View style={{ height: 8 }} />}
          renderItem={({ item: section }) => (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.items.length === 0 ? (
                <Text style={styles.sectionEmpty}>
                  No results matched your search
                </Text>
              ) : null}

              {section.key === "stores"
                ? section.items.map((store) => {
                    const isFavoriteStore = hasFavoriteStore(store.id);
                    return (
                      <View
                        key={store.id}
                        style={[styles.card, styles.storeCard]}
                      >
                        <TouchableOpacity
                          style={styles.storeCardMain}
                          onPress={() =>
                            router.push(`/customer/store/${store.id}`)
                          }
                        >
                          <View style={styles.iconWrap}>
                            <AppIcon
                              name="store"
                              variant="community"
                              size={24}
                              color={colors.text}
                            />
                          </View>
                          <View style={styles.contentWrap}>
                            <Text style={styles.productName}>{store.name}</Text>
                            <Text style={styles.meta}>Store result</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.favoriteStoreButton,
                            isFavoriteStore
                              ? styles.favoriteStoreButtonRemove
                              : styles.favoriteStoreButtonAdd,
                          ]}
                          onPress={() => toggleFavoriteStore(store.id)}
                        >
                          <AppIcon
                            name={
                              isFavoriteStore ? "store-remove" : "store-check"
                            }
                            variant="community"
                            size={18}
                            color={
                              isFavoriteStore ? colors.danger : colors.success
                            }
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                : null}

              {section.key === "sellers"
                ? section.items.map((seller) => (
                    <TouchableOpacity
                      key={seller.id}
                      style={styles.card}
                      onPress={() =>
                        router.push(`/customer/seller/${seller.id}`)
                      }
                    >
                      <View style={styles.iconWrap}>
                        <AppIcon
                          name="account-tie"
                          variant="community"
                          size={24}
                          color={colors.text}
                        />
                      </View>
                      <View style={styles.contentWrap}>
                        <Text style={styles.productName}>{seller.name}</Text>
                        <Text style={styles.meta}>Seller result</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                : null}

              {section.key === "products" ||
              section.key === "over-budget-products"
                ? section.items.map((product) =>
                    renderProductCard(product, product.id, {
                      showCategoryBadge: true,
                    }),
                  )
                : null}

              {section.key === "past-order-products"
                ? section.items.map((row) => (
                    <TouchableOpacity
                      key={row.id}
                      style={styles.card}
                      onPress={() =>
                        router.push(
                          `/customer/orders/${row.orderId}?merchantId=${row.merchantId}`,
                        )
                      }
                    >
                      <View style={styles.iconWrap}>
                        <AppIcon
                          name="history"
                          variant="community"
                          size={24}
                          color={colors.text}
                        />
                      </View>
                      <View style={styles.contentWrap}>
                        <Text style={styles.productName}>
                          {row.productName}
                        </Text>
                        <Text style={styles.meta}>
                          {row.merchantName} · {row.quantity}x
                        </Text>
                        <Text style={styles.meta}>
                          {row.createdAt?.toLocaleString?.() || "—"}
                        </Text>
                      </View>
                      <Text style={styles.pastOrderPrice}>
                        ${(row.price * row.quantity).toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  ))
                : null}
            </View>
          )}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {sortedCategoryProducts.length === 0 ? (
            <Text style={styles.empty}>No products available</Text>
          ) : null}
          {sortedCategoryProducts.map((item) =>
            renderProductCard(item, item.id),
          )}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
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
    productCard: {
      padding: 0,
    },
    storeCard: {
      padding: 0,
    },
    productCardMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      paddingRight: 8,
    },
    storeCardMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      paddingRight: 8,
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
    favoriteStoreButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      marginRight: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    favoriteStoreButtonAdd: {
      backgroundColor: colors.successSoft,
    },
    favoriteStoreButtonRemove: {
      backgroundColor: "#FDECEC",
    },
    pageTitle: {
      fontSize: 26,
      fontWeight: "700",
      marginBottom: 12,
      color: colors.text,
    },
    search: {
      backgroundColor: colors.input,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      marginBottom: 14,
      color: colors.text,
    },
    filters: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
      paddingRight: 8,
      paddingTop: 6,
      alignItems: "center",
    },
    filtersScroll: {
      marginTop: 2,
      flexGrow: 0,
      maxHeight: 40,
      minHeight: 40,
    },
    categoryPill: {
      backgroundColor: colors.pill,
      borderWidth: 1,
      borderColor: colors.pillBorder,
      borderRadius: 999,
      paddingHorizontal: 11,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryPillSelected: {
      backgroundColor: colors.pillSelected,
      borderColor: colors.pillSelectedBorder,
    },
    categoryPillText: {
      color: colors.pillText,
      fontWeight: "600",
      fontSize: 12,
    },
    categoryPillTextSelected: {
      color: colors.pillTextSelected,
    },
    categoryAllPill: {
      backgroundColor: colors.pillNeutral,
      borderColor: colors.pillNeutralBorder,
    },
    categoryAllPillSelected: {
      backgroundColor: colors.pillNeutralSelected,
      borderColor: colors.textSubtle,
    },
    categoryAllPillText: {
      color: colors.pillNeutralText,
    },
    categoryAllPillTextSelected: {
      color: colors.text,
      fontWeight: "700",
    },
    listContent: {
      paddingTop: 0,
      paddingBottom: 8,
      justifyContent: "flex-start",
      alignItems: "stretch",
      flexGrow: 0,
    },
    productName: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 2,
      color: colors.text,
    },
    productNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    resultCategoryBadge: {
      backgroundColor: colors.pill,
      borderWidth: 1,
      borderColor: colors.pillBorder,
      borderRadius: 999,
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      height: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    resultCategoryBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.pillText,
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
      marginTop: 8,
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    empty: {
      color: colors.textSubtle,
      marginTop: 20,
    },
    sectionWrap: {
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 8,
      color: colors.text,
    },
    sectionEmpty: {
      color: colors.textSubtle,
      marginBottom: 10,
    },
    meta: {
      fontSize: 12,
      color: colors.textMuted,
    },
    pastOrderPrice: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginLeft: 8,
    },
  });
