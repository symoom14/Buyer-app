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
const SORT_OPTIONS = [
  { key: PRODUCT_SORT_MODES.RECOMMENDED, label: "Recommended" },
  { key: PRODUCT_SORT_MODES.NEWEST, label: "Newest first" },
  { key: PRODUCT_SORT_MODES.PRICE_LOW_HIGH, label: "Price: low to high" },
  { key: PRODUCT_SORT_MODES.PRICE_HIGH_LOW, label: "Price: high to low" },
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

  const mix = 0.78;
  const bgR = r + (255 - r) * mix;
  const bgG = g + (255 - g) * mix;
  const bgB = b + (255 - b) * mix;

  return `#${toHexChannel(bgR)}${toHexChannel(bgG)}${toHexChannel(bgB)}`;
}

function hasKeywordMatch(searchKeywords, query) {
  if (!query) return false;
  if (Array.isArray(searchKeywords)) {
    return searchKeywords.some((keyword) =>
      String(keyword || "")
        .toLowerCase()
        .includes(query),
    );
  }
  return String(searchKeywords || "")
    .toLowerCase()
    .includes(query);
}

function getProductSearchPriority(product, query) {
  if (!query) return -1;
  const name = String(product?.name || "").toLowerCase();
  const category = String(product?.category || "").toLowerCase();

  if (name.includes(query)) return 0;
  if (category.includes(query)) return 1;
  if (hasKeywordMatch(product?.searchKeywords, query)) return 2;
  return -1;
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
  const [selectedSortMode, setSelectedSortMode] = useState(
    PRODUCT_SORT_MODES.RECOMMENDED,
  );
  const [openSortMenu, setOpenSortMenu] = useState(false);
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
      const productRatingsMap = await fetchProductRatingSummaryMap(
        db,
        rawProducts.map((product) => product.id),
      );

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

      const productOrderInstancesMap = {};
      orderSnapshot.docs.forEach((docSnap) => {
        const orderData = docSnap.data() || {};
        (orderData.items || []).forEach((item) => {
          const productId = String(item.productId || "").trim();
          if (!productId) return;
          const merchantId = String(item.merchantId || "").trim();
          const merchantStatus =
            orderData.merchantStatuses?.[merchantId]?.status ||
            orderData.status ||
            "pending";
          if (merchantStatus === "cancelled") return;

          const quantity = Math.max(1, Number(item.quantity || 1));
          productOrderInstancesMap[productId] =
            Number(productOrderInstancesMap[productId] || 0) + quantity;
        });
      });

      const enrichedProducts = rawProducts.map((product) => {
        const ownerMerchantId = storeMerchantMap[product.storeId] || "";
        const resolvedMerchantId = ownerMerchantId || product.merchantId || "";
        const ratingSummary = productRatingsMap[product.id] || {
          average: 0,
          count: 0,
        };
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
          ratingAverage: Number(ratingSummary.average || 0),
          ratingCount: Number(ratingSummary.count || 0),
          orderInstancesCount: Number(productOrderInstancesMap[product.id] || 0),
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
    const recommended = sortProducts(
      categoryFilteredProducts.filter(
        (product) => getProductSearchPriority(product, trimmedQuery) >= 0,
      ),
      selectedSortMode,
      { searchQuery: trimmedQuery },
    );
    if (selectedSortMode !== PRODUCT_SORT_MODES.RECOMMENDED) {
      return recommended;
    }
    return recommended.sort((a, b) => {
      const aPriority = getProductSearchPriority(a, trimmedQuery);
      const bPriority = getProductSearchPriority(b, trimmedQuery);
      if (aPriority !== bPriority) return aPriority - bPriority;
      return 0;
    });
  }, [categoryFilteredProducts, isSearching, selectedSortMode, trimmedQuery]);
  const overBudgetProductResults = useMemo(() => {
    if (!isSearching || masterMaxPrice == null) return [];
    const recommended = sortProducts(
      products.filter((product) => {
        const price = Number(product.price || 0);
        return (
          getProductSearchPriority(product, trimmedQuery) >= 0 &&
          price > masterMaxPrice
        );
      }),
      selectedSortMode,
      { searchQuery: trimmedQuery },
    );
    if (selectedSortMode !== PRODUCT_SORT_MODES.RECOMMENDED) {
      return recommended;
    }
    return recommended.sort((a, b) => {
      const aPriority = getProductSearchPriority(a, trimmedQuery);
      const bPriority = getProductSearchPriority(b, trimmedQuery);
      if (aPriority !== bPriority) return aPriority - bPriority;
      return 0;
    });
  }, [isSearching, masterMaxPrice, products, selectedSortMode, trimmedQuery]);
  const selectedSortLabel = useMemo(
    () =>
      SORT_OPTIONS.find((option) => option.key === selectedSortMode)?.label ||
      "Recommended",
    [selectedSortMode],
  );

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
              <View style={styles.priceRow}>
                <Text style={styles.price}>${Number(product.price || 0).toFixed(2)}</Text>
                <View style={styles.ratingPill}>
                  <AppIcon
                    name={
                      Number(product.ratingCount || 0) > 0
                        ? "star"
                        : "star-settings-outline"
                    }
                    variant="community"
                    size={12}
                    color="#F4B400"
                  />
                  <Text style={styles.ratingPillText}>
                    {Number(product.ratingCount || 0) > 0
                      ? `${Number(product.ratingAverage || 0).toFixed(1)} (${Number(
                          product.ratingCount || 0,
                        )})`
                      : "0"}
                  </Text>
                </View>
              </View>
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
      <View style={styles.searchWrap}>
        <AppIcon
          name="magnify"
          variant="community"
          size={20}
          color={colors.textSubtle}
        />
        <TextInput
          style={styles.search}
          placeholder="Search products, stores, sellers"
          placeholderTextColor={colors.textSubtle}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setOpenSortMenu(false)}
          clearButtonMode="while-editing"
        />
      </View>
      {isSearching ? (
        <View style={styles.sortRow}>
          <View style={styles.sortDropdownWrap}>
            <TouchableOpacity
              style={styles.sortTrigger}
              activeOpacity={0.85}
              onPress={() => setOpenSortMenu((prev) => !prev)}
            >
              <Text style={styles.sortTriggerText} numberOfLines={1}>
                Sort: {selectedSortLabel}
              </Text>
              <AppIcon
                name={openSortMenu ? "chevron-up" : "chevron-down"}
                variant="community"
                size={16}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
            {openSortMenu ? (
              <View style={styles.sortMenu}>
                {SORT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={styles.sortMenuItem}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSelectedSortMode(option.key);
                      setOpenSortMenu(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.sortMenuItemText,
                        option.key === selectedSortMode &&
                          styles.sortMenuItemTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
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
          onScrollBeginDrag={() => setOpenSortMenu(false)}
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
          onScrollBeginDrag={() => setOpenSortMenu(false)}
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
    searchWrap: {
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
      paddingLeft: 12,
      paddingRight: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    sortRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 8,
      zIndex: 20,
    },
    sortDropdownWrap: {
      flex: 1,
      position: "relative",
      zIndex: 30,
    },
    sortTrigger: {
      height: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.input,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    sortTriggerText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 16,
      color: colors.text,
      alignSelf: "center",
    },
    sortMenu: {
      position: "absolute",
      top: 46,
      left: 0,
      right: 0,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      zIndex: 40,
      elevation: 4,
      overflow: "hidden",
    },
    sortMenuItem: {
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    sortMenuItemText: {
      fontSize: 12,
      color: colors.text,
    },
    sortMenuItemTextSelected: {
      color: colors.success,
      fontWeight: "700",
    },
    search: {
      flex: 1,
      fontSize: 15,
      paddingVertical: 0,
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
