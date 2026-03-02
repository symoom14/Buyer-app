import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppIcon from "../../src/components/AppIcon";
import QuickCheckoutButton from "../../src/components/QuickCheckoutButton";
import ScreenContainer from "../../src/components/ScreenContainer";
import { useCart } from "../../src/context/CartContext";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";
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
const HEADER_COLLAPSE_DISTANCE = 90;

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

export default function CustomerHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart } = useCart();
  const { colors, isDark } = useAppTheme();
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [browseProducts, setBrowseProducts] = useState([]);
  const [browseStores, setBrowseStores] = useState([]);
  const [browseSellers, setBrowseSellers] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [popularProducts, setPopularProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [buyAgainProducts, setBuyAgainProducts] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const [selectedSuburb, setSelectedSuburb] = useState("Home");
  const [showAddressMenu, setShowAddressMenu] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const styles = createStyles(colors, isDark);
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_COLLAPSE_DISTANCE],
    outputRange: [insets.top + 108, insets.top + 46],
    extrapolate: "clamp",
  });
  const titleScale = scrollY.interpolate({
    inputRange: [0, HEADER_COLLAPSE_DISTANCE],
    outputRange: [1, 0.84],
    extrapolate: "clamp",
  });
  const iconScale = scrollY.interpolate({
    inputRange: [0, HEADER_COLLAPSE_DISTANCE],
    outputRange: [1, 0.88],
    extrapolate: "clamp",
  });
  const addressOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_COLLAPSE_DISTANCE * 0.58],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const addressTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_COLLAPSE_DISTANCE * 0.58],
    outputRange: [0, -10],
    extrapolate: "clamp",
  });

  const loadRecentOrders = useCallback(async (customerId) => {
    if (!customerId) {
      setPopularProducts([]);
      setRecentOrders([]);
      setBuyAgainProducts([]);
      setOrdersLoading(false);
      return;
    }

    setOrdersLoading(true);
    try {
      const [ordersSnapshot, productsSnapshot] = await Promise.all([
        getDocs(collection(db, "orders")),
        getDocs(collection(db, "products")),
      ]);

      const productIconById = {};
      const productDataById = {};
      productsSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        productDataById[String(docSnap.id)] = data;
        productIconById[String(docSnap.id)] =
          data?.iconName || data?.icon || DEFAULT_PRODUCT_ICON;
      });
      const productRatingsMap = await fetchProductRatingSummaryMap(
        db,
        Object.keys(productDataById),
      );

      const customerOrders = ordersSnapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((order) => order.customerId === customerId);

      const orders = customerOrders
        .map((order) => {
          const items = (order.items || []).map((item) => ({
            ...item,
            iconName:
              item.iconName ||
              productIconById[String(item.productId)] ||
              DEFAULT_PRODUCT_ICON,
          }));
          const total = items.reduce(
            (sum, item) =>
              sum + Number(item.price || 0) * Number(item.quantity || 0),
            0,
          );
          return {
            id: order.id,
            createdAt: order.createdAt?.toDate?.() || new Date(0),
            items,
            total,
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 6);

      const topByProduct = {};
      customerOrders.forEach((order) => {
        const orderTime = order.createdAt?.toDate?.()?.getTime?.() || 0;
        (order.items || []).forEach((item) => {
          const productId = String(item.productId || "");
          if (!productId) return;
          if (!topByProduct[productId]) {
            const productData = productDataById[productId] || {};
            topByProduct[productId] = {
              id: productId,
              name: item.name || productData?.name || "Product",
              // Keep historical order pricing immutable; never fallback to current catalog price.
              price: Number(item.price ?? 0),
              iconName:
                item.iconName ||
                productData?.iconName ||
                productData?.icon ||
                DEFAULT_PRODUCT_ICON,
              iconColor:
                ICON_COLOR_POOL[
                  productId
                    .split("")
                    .reduce((sum, char) => sum + char.charCodeAt(0), 0) %
                    ICON_COLOR_POOL.length
                ],
              quantity: 0,
              lastOrderedAt: 0,
              merchantId: item.merchantId || "unknown",
              merchantName: item.merchantName || "Unknown Seller",
              ratingAverage: Number(
                productRatingsMap[productId]?.average || 0,
              ),
              ratingCount: Number(productRatingsMap[productId]?.count || 0),
            };
          }
          topByProduct[productId].quantity += Number(item.quantity || 0);
          topByProduct[productId].lastOrderedAt = Math.max(
            topByProduct[productId].lastOrderedAt,
            orderTime,
          );
        });
      });

      const topProducts = Object.values(topByProduct)
        .sort((a, b) => {
          if (b.quantity !== a.quantity) return b.quantity - a.quantity;
          return b.lastOrderedAt - a.lastOrderedAt;
        })
        .slice(0, 4);

      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const globalPopularityByProduct = {};
      ordersSnapshot.docs.forEach((docSnap) => {
        const orderData = docSnap.data() || {};
        const orderTime = orderData.createdAt?.toDate?.()?.getTime?.() || 0;
        if (orderTime < weekAgo) return;
        const productIdsInOrder = new Set();
        (orderData.items || []).forEach((item) => {
          const productId = String(item.productId || "");
          if (!productId) return;
          const merchantId = item.merchantId || "";
          const merchantStatus =
            orderData.merchantStatuses?.[merchantId]?.status ||
            orderData.status ||
            "pending";
          if (merchantStatus === "cancelled") return;
          productIdsInOrder.add(productId);
        });

        productIdsInOrder.forEach((productId) => {
          const current = globalPopularityByProduct[productId] || {
            id: productId,
            orderCount: 0,
            lastOrderedAt: 0,
            fallbackName: "Product",
          };
          current.orderCount += 1;
          current.lastOrderedAt = Math.max(current.lastOrderedAt, orderTime);
          globalPopularityByProduct[productId] = current;
        });
      });

      const popularThisWeekProducts = Object.values(globalPopularityByProduct)
        .map((entry) => {
          const productData = productDataById[entry.id] || {};
          const colorIndex =
            entry.id
              .split("")
              .reduce((sum, char) => sum + char.charCodeAt(0), 0) %
            ICON_COLOR_POOL.length;
          return {
            id: entry.id,
            name: productData?.name || entry.fallbackName || "Product",
            price: Number(productData?.price || 0),
            iconName:
              productData?.iconName || productData?.icon || DEFAULT_PRODUCT_ICON,
            iconColor: ICON_COLOR_POOL[colorIndex],
            orderCount: entry.orderCount,
            lastOrderedAt: entry.lastOrderedAt,
            ratingAverage: Number(productRatingsMap[entry.id]?.average || 0),
            ratingCount: Number(productRatingsMap[entry.id]?.count || 0),
          };
        })
        .sort((a, b) => {
          if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
          return b.lastOrderedAt - a.lastOrderedAt;
        });

      setPopularProducts(popularThisWeekProducts);
      setRecentOrders(orders);
      setBuyAgainProducts(topProducts);
    } catch (error) {
      console.error("Failed to load recent orders:", error);
      setPopularProducts([]);
      setRecentOrders([]);
      setBuyAgainProducts([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadBrowseData = useCallback(async () => {
    setProductsLoading(true);
    try {
      const [productsSnap, storesSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "stores")),
        getDocs(collection(db, "users")),
      ]);

      const productItems = productsSnap.docs.map((docSnap) => {
        const data = docSnap.data();
        const colorIdx = Math.floor(Math.random() * ICON_COLOR_POOL.length);
        return {
          id: docSnap.id,
          name: data?.name || "Unnamed product",
          category: String(data?.category || "").trim(),
          searchKeywords: data?.searchKeywords || [],
          price: Number(data?.price || 0),
          iconName: data?.iconName || DEFAULT_PRODUCT_ICON,
          iconColor: ICON_COLOR_POOL[colorIdx],
          createdAt: data?.createdAt?.toDate?.() || new Date(0),
        };
      });
      const productRatingsMap = await fetchProductRatingSummaryMap(
        db,
        productItems.map((product) => product.id),
      );
      const ratedProductItems = productItems.map((product) => {
        const ratingSummary = productRatingsMap[product.id] || {
          average: 0,
          count: 0,
        };
        return {
          ...product,
          ratingAverage: Number(ratingSummary.average || 0),
          ratingCount: Number(ratingSummary.count || 0),
        };
      });

      const storeItems = storesSnap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data?.name || "Unknown store",
        };
      });

      const sellerItems = usersSnap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((user) => user.role === "merchant")
        .map((user) => ({
          id: user.id,
          name: getUserDisplayName(user, "Unknown seller"),
        }));

      setBrowseProducts(ratedProductItems);
      setBrowseStores(storeItems);
      setBrowseSellers(sellerItems);
    } catch (error) {
      console.error("Failed to load home products:", error);
      setBrowseProducts([]);
      setBrowseStores([]);
      setBrowseSellers([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribeNotifications = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeNotifications();

      if (!user?.uid) {
        setHasUnreadNotifications(false);
        return;
      }

      const unreadQuery = query(
        collection(db, "notifications"),
        where("recipientId", "==", user.uid),
        where("read", "==", false),
      );

      unsubscribeNotifications = onSnapshot(
        unreadQuery,
        (snap) => {
          const hasUnread = snap.docs.some(
            (docSnap) => docSnap.data()?.recipientRole === "customer",
          );
          setHasUnreadNotifications(hasUnread);
        },
        () => setHasUnreadNotifications(false),
      );
    });

    return () => {
      unsubscribeNotifications();
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    loadBrowseData();
  }, [loadBrowseData]);

  useEffect(() => {
    let active = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      await loadRecentOrders(user?.uid);
    });

    return () => {
      active = false;
      unsub();
    };
  }, [loadRecentOrders]);

  useFocusEffect(
    useCallback(() => {
      const userId = auth.currentUser?.uid;
      loadRecentOrders(userId);
    }, [loadRecentOrders]),
  );

  const newArrivals = useMemo(
    () =>
      [...browseProducts].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      ),
    [browseProducts],
  );

  const underHundred = useMemo(
    () => browseProducts.filter((p) => p.price < 100),
    [browseProducts],
  );
  const trimmedGlobalQuery = globalQuery.trim().toLowerCase();
  const liveProductMatches = useMemo(() => {
    if (!trimmedGlobalQuery) return [];
    return browseProducts
      .map((product) => ({
        product,
        priority: getProductSearchPriority(product, trimmedGlobalQuery),
      }))
      .filter((entry) => entry.priority >= 0)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return String(a.product.name || "").localeCompare(
          String(b.product.name || ""),
        );
      })
      .map((entry) => entry.product);
  }, [browseProducts, trimmedGlobalQuery]);
  const liveProductResults = useMemo(
    () => liveProductMatches.slice(0, 5),
    [liveProductMatches],
  );
  const liveProductMoreCount = Math.max(liveProductMatches.length - 5, 0);
  const liveStoreResults = useMemo(() => {
    if (!trimmedGlobalQuery) return [];
    return browseStores
      .filter((store) =>
        String(store.name || "")
          .toLowerCase()
          .includes(trimmedGlobalQuery),
      )
      .slice(0, 8);
  }, [browseStores, trimmedGlobalQuery]);
  const liveSellerResults = useMemo(() => {
    if (!trimmedGlobalQuery) return [];
    return browseSellers
      .filter((seller) =>
        String(seller.name || "")
          .toLowerCase()
          .includes(trimmedGlobalQuery),
      )
      .slice(0, 8);
  }, [browseSellers, trimmedGlobalQuery]);

  const renderProductCarousel = (
    title,
    products,
    seeMorePath = "/customer/product",
    showRatingBadge = false,
  ) => {
    const visibleProducts = products.slice(0, 6);
    return (
      <View style={styles.carouselSection} key={title}>
        <Text style={styles.carouselTitle}>{title}</Text>
        {productsLoading ? (
          <View style={styles.carouselLoading}>
            <ActivityIndicator size="small" />
          </View>
        ) : products.length === 0 ? (
          <Text style={styles.carouselEmpty}>No products available.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {visibleProducts.map((product) => (
              <TouchableOpacity
                key={`${title}-${product.id}`}
                style={styles.productCard}
                onPress={() => router.push(`/customer/product/${product.id}`)}
              >
                <View style={styles.productCardRow}>
                  <View style={styles.productIconWrap}>
                    <AppIcon
                      name={product.iconName}
                      variant="community"
                      size={30}
                      color={product.iconColor}
                    />
                  </View>
                  <View style={styles.productMeta}>
                    <Text numberOfLines={1} style={styles.productName}>
                      {product.name}
                    </Text>
                    <View style={styles.productPriceRow}>
                      <Text style={styles.productPrice}>
                        ${Number(product.price || 0).toFixed(2)}
                      </Text>
                      {showRatingBadge ? (
                        <View style={styles.productRatingPill}>
                          <AppIcon
                            name={
                              Number(product.ratingCount || 0) > 0
                                ? "star"
                                : "star-settings-outline"
                            }
                            variant="community"
                            size={11}
                            color="#F4B400"
                          />
                          <Text style={styles.productRatingPillText}>
                            {Number(product.ratingCount || 0) > 0
                              ? `${Number(product.ratingAverage || 0).toFixed(1)} (${Number(
                                  product.ratingCount || 0,
                                )})`
                              : "0"}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.seeMoreCard}
              onPress={() => router.push(seeMorePath)}
            >
              <AppIcon
                name="arrow-right"
                variant="community"
                size={24}
                color={colors.text}
              />
              <Text style={styles.seeMoreText}>See more</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    );
  };

  const handleGlobalSearch = () => {
    const queryText = globalQuery.trim();
    if (!queryText) {
      router.push("/customer/product");
      return;
    }
    router.push({
      pathname: "/customer/product",
      params: { q: queryText },
    });
  };
  const handleClearGlobalSearch = () => {
    setGlobalQuery("");
  };

  const handleQuickCheckout = useCallback(
    (product) => {
      router.push(`/customer/quick-checkout/${product.id}`);
    },
    [router],
  );
  const handlePullToRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setShowAddressMenu(false);
    try {
      await Promise.all([
        loadBrowseData(),
        loadRecentOrders(auth.currentUser?.uid),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadBrowseData, loadRecentOrders, refreshing]);

  return (
    <ScreenContainer disableBottomInset bottomPadding={0}>
      <Animated.View style={[styles.topRowWrap, { height: headerHeight }]}>
        <Animated.View
          style={[
            styles.topRow,
            {
              paddingTop: insets.top + 8,
            },
          ]}
        >
          <Animated.Text
            style={[styles.heroTitle, { transform: [{ scale: titleScale }] }]}
          >
            Buyer
          </Animated.Text>

          <View style={styles.headerActions}>
            {cart.length > 0 ? (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push("/customer/cart")}
              >
                <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                  <Ionicons
                    name="basket"
                    size={30}
                    color={colors.customerHeaderText}
                  />
                </Animated.View>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push("/customer/notifications")}
            >
              <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                <AppIcon
                  name={hasUnreadNotifications ? "bell-badge" : "bell-outline"}
                  variant="community"
                  size={26}
                  color={colors.customerHeaderText}
                />
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push("/customer/profile")}
            >
              <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                <Ionicons
                  name="person-circle-outline"
                  size={30}
                  color={colors.customerHeaderText}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </Animated.View>
        <Animated.View
          style={[
            styles.addressRowWrap,
            {
              opacity: addressOpacity,
              transform: [{ translateY: addressTranslateY }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.addressPill}
            onPress={() => setShowAddressMenu((prev) => !prev)}
            activeOpacity={0.85}
          >
            <AppIcon
              name="map-marker-outline"
              variant="community"
              size={15}
              color={colors.customerHeaderText}
            />
            <Text style={styles.addressText} numberOfLines={1}>
              Delivering to: {selectedSuburb}
            </Text>
            <AppIcon
              name={showAddressMenu ? "chevron-up" : "chevron-down"}
              variant="community"
              size={15}
              color={colors.customerHeaderText}
            />
          </TouchableOpacity>
          {showAddressMenu ? (
            <View style={styles.addressMenu}>
              {["Home", "Work"].map((option, index) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.addressMenuItem,
                    index === 0 && styles.addressMenuItemFirst,
                    index === 1 && styles.addressMenuItemLast,
                  ]}
                  onPress={() => {
                    setSelectedSuburb(option);
                    setShowAddressMenu(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addressMenuItemText}>{option}</Text>
                  {selectedSuburb === option ? (
                    <AppIcon
                      name="check"
                      variant="community"
                      size={14}
                      color={colors.primary}
                    />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </Animated.View>
      </Animated.View>

      {/* Dashboard content */}
      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullToRefresh}
            tintColor={colors.customerHeaderText}
            colors={[colors.customerHeaderText]}
          />
        }
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
      >
        <View style={styles.browseSection}>
          <View style={styles.globalSearchWrap}>
            <AppIcon
              name="magnify"
              variant="community"
              size={20}
              color={colors.customerHomeHeaderText}
            />
            <TextInput
              style={styles.globalSearchInput}
              placeholder="Search products, stores, sellers"
              placeholderTextColor={colors.textSubtle}
              value={globalQuery}
              onChangeText={setGlobalQuery}
              returnKeyType="search"
              onSubmitEditing={handleGlobalSearch}
            />
            {trimmedGlobalQuery ? (
              <TouchableOpacity
                onPress={handleClearGlobalSearch}
                style={styles.globalSearchClearBtn}
              >
                <AppIcon
                  name="close"
                  variant="community"
                  size={16}
                  color={colors.text}
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={handleGlobalSearch}
              style={styles.globalSearchAction}
            >
              <AppIcon
                name="arrow-right"
                variant="community"
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
          {trimmedGlobalQuery ? (
            <View style={styles.liveSearchCard}>
              {liveProductResults.length === 0 &&
              liveStoreResults.length === 0 &&
              liveSellerResults.length === 0 ? (
                <Text style={styles.liveSearchEmpty}>No matching results.</Text>
              ) : (
                <>
                  {liveProductResults.length > 0 ? (
                    <View style={styles.liveSearchSection}>
                      <Text style={styles.liveSearchSectionTitle}>
                        Products
                      </Text>
                      {liveProductResults.map((product, index) => (
                        <TouchableOpacity
                          key={`live-product-${product.id}`}
                          style={[
                            styles.liveSearchRow,
                            index < liveProductResults.length - 1 &&
                              styles.liveSearchRowDivider,
                          ]}
                          onPress={() => {
                            setGlobalQuery("");
                            router.push(`/customer/product/${product.id}`);
                          }}
                        >
                          <View
                            style={[
                              styles.liveSearchIconWrap,
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
                              size={18}
                              color={product.iconColor || colors.text}
                            />
                          </View>
                          <View style={styles.liveSearchMeta}>
                            <Text
                              numberOfLines={1}
                              style={styles.liveSearchName}
                            >
                              {product.name}
                            </Text>
                            <Text style={styles.liveSearchPrice}>
                              ${Number(product.price || 0).toFixed(2)}
                            </Text>
                          </View>
                          <AppIcon
                            name="arrow-right"
                            variant="community"
                            size={18}
                            color={colors.textSubtle}
                          />
                        </TouchableOpacity>
                      ))}
                      {liveProductMoreCount > 0 ? (
                        <Text style={styles.liveSearchMoreText}>
                          +{liveProductMoreCount} more
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {liveStoreResults.length > 0 ? (
                    <View style={styles.liveSearchSection}>
                      <Text style={styles.liveSearchSectionTitle}>Stores</Text>
                      {liveStoreResults.map((store, index) => (
                        <TouchableOpacity
                          key={`live-store-${store.id}`}
                          style={[
                            styles.liveSearchRow,
                            index < liveStoreResults.length - 1 &&
                              styles.liveSearchRowDivider,
                          ]}
                          onPress={() => {
                            setGlobalQuery("");
                            router.push(`/customer/store/${store.id}`);
                          }}
                        >
                          <View style={styles.liveSearchIconWrap}>
                            <AppIcon
                              name="store-outline"
                              variant="community"
                              size={18}
                              color={colors.text}
                            />
                          </View>
                          <View style={styles.liveSearchMeta}>
                            <Text
                              numberOfLines={1}
                              style={styles.liveSearchName}
                            >
                              {store.name}
                            </Text>
                          </View>
                          <AppIcon
                            name="arrow-right"
                            variant="community"
                            size={18}
                            color={colors.textSubtle}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}

                  {liveSellerResults.length > 0 ? (
                    <View style={styles.liveSearchSection}>
                      <Text style={styles.liveSearchSectionTitle}>Sellers</Text>
                      {liveSellerResults.map((seller, index) => (
                        <TouchableOpacity
                          key={`live-seller-${seller.id}`}
                          style={[
                            styles.liveSearchRow,
                            index < liveSellerResults.length - 1 &&
                              styles.liveSearchRowDivider,
                          ]}
                          onPress={() => {
                            setGlobalQuery("");
                            router.push(`/customer/seller/${seller.id}`);
                          }}
                        >
                          <View style={styles.liveSearchIconWrap}>
                            <AppIcon
                              name="account-tie"
                              variant="community"
                              size={18}
                              color={colors.text}
                            />
                          </View>
                          <View style={styles.liveSearchMeta}>
                            <Text
                              numberOfLines={1}
                              style={styles.liveSearchName}
                            >
                              {seller.name}
                            </Text>
                          </View>
                          <AppIcon
                            name="arrow-right"
                            variant="community"
                            size={18}
                            color={colors.textSubtle}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </>
              )}
            </View>
          ) : null}
          {renderProductCarousel(
            "Popular this week",
            popularProducts,
            "/customer/product",
            true,
          )}
          {renderProductCarousel("New arrivals", newArrivals)}
          {renderProductCarousel(
            "Under $100",
            underHundred,
            "/customer/budget/100",
            true,
          )}
        </View>

        <View style={styles.buyAgainSection}>
          <Text style={styles.ordersTitle}>Buy again</Text>
          {ordersLoading ? (
            <View style={styles.carouselLoading}>
              <ActivityIndicator size="small" />
            </View>
          ) : buyAgainProducts.length === 0 ? (
            <Text style={styles.carouselEmpty}>No frequent products yet.</Text>
          ) : (
            <View style={styles.buyAgainGrid}>
              {buyAgainProducts.map((product, index) => (
                <TouchableOpacity
                  key={`buy-again-${product.id}`}
                  style={[
                    styles.buyAgainCard,
                    index % 2 === 0 && styles.buyAgainCardLeft,
                  ]}
                  onPress={() => router.push(`/customer/product/${product.id}`)}
                >
                  <View style={styles.buyAgainCardRow}>
                    <View style={styles.buyAgainLeft}>
                      <View style={styles.buyAgainTitleRow}>
                        <View style={styles.buyAgainIconWrap}>
                          <AppIcon
                            name={product.iconName || DEFAULT_PRODUCT_ICON}
                            variant="community"
                            size={22}
                            color={product.iconColor || colors.text}
                          />
                        </View>
                        <Text numberOfLines={1} style={styles.buyAgainName}>
                          {product.name}
                        </Text>
                      </View>
                      <Text style={styles.buyAgainPrice}>
                        ${Number(product.price || 0).toFixed(2)}
                      </Text>
                    </View>
                    <QuickCheckoutButton
                      onPress={() => handleQuickCheckout(product)}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.ordersSection}>
          <Text style={styles.ordersTitle}>Recent orders</Text>
          {ordersLoading ? (
            <View style={styles.carouselLoading}>
              <ActivityIndicator size="small" />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recentOrders.map((order) => {
                const previewItems = order.items.slice(0, 2);
                const extraCount = Math.max(
                  order.items.length - previewItems.length,
                  0,
                );
                return (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.recentOrderCard}
                    onPress={() => router.push(`/customer/order/${order.id}`)}
                  >
                    <View style={styles.recentOrderLeft}>
                      {previewItems.map((item, idx) => (
                        <View
                          key={`${order.id}-${item.productId || item.name}-${idx}`}
                          style={styles.recentOrderItemRow}
                        >
                          <View style={styles.recentOrderItemIconWrap}>
                            <AppIcon
                              name={item.iconName || DEFAULT_PRODUCT_ICON}
                              variant="community"
                              size={14}
                              color={colors.text}
                            />
                          </View>
                          <Text
                            numberOfLines={1}
                            style={styles.recentOrderItemText}
                          >
                            {item.name || "Item"}
                          </Text>
                        </View>
                      ))}
                      {extraCount > 0 ? (
                        <Text style={styles.recentOrderMoreText}>
                          +{extraCount} more
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.recentOrderRight}>
                      <Text style={styles.recentOrderTotalLabel}>Total</Text>
                      <Text style={styles.recentOrderTotalValue}>
                        ${order.total.toFixed(2)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.showAllOrdersCard}
                onPress={() => router.push("/customer/orders")}
              >
                <AppIcon
                  name="arrow-right"
                  variant="community"
                  size={24}
                  color={colors.text}
                />
                <Text style={styles.seeMoreText}>Show all orders</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
          {!ordersLoading && recentOrders.length === 0 ? (
            <Text style={styles.carouselEmpty}>No orders yet.</Text>
          ) : null}
        </View>
      </Animated.ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors, isDark) =>
  StyleSheet.create({
    topRowWrap: {
      overflow: "visible",
      marginBottom: 6,
      zIndex: 40,
      elevation: 40,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: 2,
    },
    addressRowWrap: {
      paddingTop: 5,
      alignItems: "flex-start",
      zIndex: 50,
      position: "relative",
    },
    addressPill: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 999,
      borderWidth: 0,
      backgroundColor: "transparent",
      paddingVertical: 3,
      paddingHorizontal: 2,
      gap: 6,
      maxWidth: "85%",
    },
    addressText: {
      fontSize: 11,
      fontWeight: "500",
      color: isDark ? "rgba(255,255,255,0.75)" : "rgba(17,24,28,0.7)",
    },
    addressMenu: {
      marginTop: 0,
      position: "absolute",
      top: 30,
      left: 0,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      minWidth: 120,
      overflow: "hidden",
      zIndex: 60,
      elevation: 60,
    },
    addressMenuItem: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    addressMenuItemFirst: {
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
    },
    addressMenuItemLast: {
      borderBottomWidth: 0,
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
    },
    addressMenuItemText: {
      fontSize: 12,
      color: colors.text,
      fontWeight: "600",
    },
    heroTitle: {
      fontSize: 42,
      lineHeight: 42,
      fontWeight: "800",
      color: colors.customerHomeHeaderText,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    actionBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      paddingBottom: 16,
    },
    scroll: {
      flex: 1,
    },
    browseSection: {
      marginBottom: 24,
      marginTop: 0,
    },
    ordersSection: {
      marginBottom: 24,
    },
    buyAgainSection: {
      marginBottom: 24,
    },
    ordersTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 10,
    },
    globalSearchWrap: {
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
      paddingLeft: 12,
      paddingRight: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    globalSearchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      paddingVertical: 0,
    },
    globalSearchAction: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.customerHomeHeaderText,
      alignItems: "center",
      justifyContent: "center",
    },
    globalSearchClearBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    liveSearchCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.surface : "#fafafb",
      marginBottom: 14,
      overflow: "hidden",
    },
    liveSearchSection: {
      paddingTop: 8,
    },
    liveSearchSectionTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSubtle,
      paddingHorizontal: 12,
      paddingBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    liveSearchRow: {
      minHeight: 56,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    liveSearchRowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    liveSearchIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    liveSearchMeta: {
      flex: 1,
      paddingRight: 6,
    },
    liveSearchName: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 2,
    },
    liveSearchPrice: {
      fontSize: 12,
      color: colors.textSubtle,
    },
    liveSearchEmpty: {
      fontSize: 13,
      color: colors.textSubtle,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    liveSearchMoreText: {
      fontSize: 12,
      color: colors.customerHomeHeaderText,
      fontWeight: "600",
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 10,
    },
    carouselSection: {
      marginBottom: 16,
    },
    carouselTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    carouselLoading: {
      height: 100,
      alignItems: "center",
      justifyContent: "center",
    },
    carouselEmpty: {
      fontSize: 13,
      color: colors.textSubtle,
      marginBottom: 4,
    },
    productCard: {
      width: 220,
      height: 92,
      borderRadius: 12,
      backgroundColor: colors.surface,
      marginRight: 10,
      padding: 12,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    productCardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    productIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    productMeta: {
      flex: 1,
      justifyContent: "center",
    },
    productName: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 5,
    },
    productPrice: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    productPriceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    productRatingPill: {
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    productRatingPillText: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: "600",
    },
    seeMoreCard: {
      width: 120,
      height: 92,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      marginRight: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    seeMoreText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    buyAgainGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    buyAgainCard: {
      width: "48%",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginBottom: 10,
      minHeight: 74,
    },
    buyAgainCardLeft: {
      marginRight: "4%",
    },
    buyAgainCardRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    buyAgainLeft: {
      flex: 1,
      marginRight: 8,
      alignSelf: "stretch",
      justifyContent: "space-between",
    },
    buyAgainTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 5,
    },
    buyAgainIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    buyAgainName: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
    },
    buyAgainPrice: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    orderActionCard: {
      width: 220,
      height: 92,
      borderRadius: 12,
      marginRight: 10,
      padding: 12,
      justifyContent: "center",
    },
    orderActionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    orderActionIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: "rgba(255, 255, 255, 0.65)",
      alignItems: "center",
      justifyContent: "center",
    },
    orderActionMeta: {
      flex: 1,
    },
    orderActionTitle: {
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 4,
    },
    orderActionCaption: {
      fontSize: 12,
      fontWeight: "600",
      opacity: 0.8,
    },
    recentOrderCard: {
      width: 290,
      height: 96,
      borderRadius: 12,
      marginRight: 10,
      padding: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    recentOrderLeft: {
      flex: 1,
      gap: 5,
      justifyContent: "center",
    },
    recentOrderItemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    recentOrderItemIconWrap: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    recentOrderItemText: {
      flex: 1,
      fontSize: 12,
      fontWeight: "600",
      color: colors.text,
    },
    recentOrderMoreText: {
      fontSize: 12,
      color: colors.customerHomeHeaderText,
      marginTop: 1,
    },
    recentOrderRight: {
      alignItems: "flex-end",
      justifyContent: "center",
      minWidth: 86,
    },
    recentOrderTotalLabel: {
      fontSize: 11,
      color: colors.textSubtle,
      marginBottom: 2,
    },
    recentOrderTotalValue: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    showAllOrdersCard: {
      width: 150,
      height: 96,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      marginRight: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
      paddingHorizontal: 8,
    },
  });
