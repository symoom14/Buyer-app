import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "../../../src/components/AppIcon";
import ScreenContainer from "../../../src/components/ScreenContainer";
import { useCart } from "../../../src/context/CartContext";
import { useFavorites } from "../../../src/context/FavoritesContext";
import { db } from "../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../src/theme/useAppTheme";
import { getUserDisplayName } from "../../../src/utils/userDisplayName";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const FAVORITE_ICON_SIZE = 21;
const FAVORITE_ICON_WRAP_SIZE = FAVORITE_ICON_SIZE + 8;
const PRODUCT_ACTIONS_HEIGHT = 96;
const ICON_COLOR_POOL = [
  "#E53935", // red
  "#2E7D32", // green
  "#1E88E5", // blue
  "#FFA700", // chrome yellow
  "#F57C00", // orange
];

export default function ProductDetails() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const productId = Array.isArray(params.productId)
    ? params.productId[0]
    : params.productId;

  const { cart, addToCart } = useCart();
  const { hasFavorite, toggleFavorite } = useFavorites();

  const [product, setProduct] = useState(null);
  const [store, setStore] = useState(null);
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const favoriteAnim = useRef(new Animated.Value(0)).current;
  const isFavorite = hasFavorite(productId);
  const iconColor = useMemo(() => {
    const idx = Math.floor(Math.random() * ICON_COLOR_POOL.length);
    return ICON_COLOR_POOL[idx];
  }, []);

  useEffect(() => {
    Animated.timing(favoriteAnim, {
      toValue: isFavorite ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [favoriteAnim, isFavorite]);

  const fetchData = useCallback(async () => {
    const productSnap = await getDoc(doc(db, "products", productId));
    if (!productSnap.exists()) return;

    const productData = productSnap.data();
    setProduct(productData);

    const storeSnap = await getDoc(doc(db, "stores", productData.storeId));
    if (storeSnap.exists()) {
      const storeData = storeSnap.data();
      setStore(storeData);

      const merchantSnap = await getDoc(doc(db, "users", storeData.merchantId));
      if (merchantSnap.exists()) {
        setMerchant(merchantSnap.data());
      }
    }

    setLoading(false);
  }, [productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddToCart = () => {
    addToCart({
      productId,
      name: product.name,
      price: product.price,
      quantity: 1,
      storeId: product.storeId,
      storeName: store?.name || "Unknown store",
      merchantId: store?.merchantId || "unknown",
      merchantName: getUserDisplayName(merchant, "Unknown merchant"),
    });
  };

  const handleFavoritePress = () => {
    toggleFavorite(productId);
  };
  const handleQuickBuy = () => {
    router.push(`/customer/quick-checkout/${productId}`);
  };
  const sellerName = getUserDisplayName(merchant, "Unknown");
  const isInCart = cart.some((item) => item.productId === productId);
  const handlePrimaryCartAction = () => {
    if (isInCart) {
      router.push("/customer/cart");
      return;
    }
    handleAddToCart();
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size="large" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer disableBottomInset bottomPadding={0}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + PRODUCT_ACTIONS_HEIGHT },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaPillsRow}>
          <TouchableOpacity
            style={styles.metaPill}
            onPress={() => {
              if (!store?.merchantId) return;
              router.push(`/customer/seller/${store.merchantId}`);
            }}
          >
            <AppIcon
              name="account-tie"
              variant="community"
              size={13}
              color={colors.textMuted}
            />
            <Text numberOfLines={1} style={styles.metaPillText}>
              {sellerName}
            </Text>
          </TouchableOpacity>
          <View style={styles.metaArrowChip}>
            <AppIcon
              name="chevron-right"
              variant="community"
              size={14}
              color={colors.textMuted}
            />
          </View>
          <TouchableOpacity
            style={styles.metaPill}
            onPress={() => router.push(`/customer/store/${product.storeId}`)}
          >
            <AppIcon
              name="store"
              variant="community"
              size={13}
              color={colors.textMuted}
            />
            <Text numberOfLines={1} style={styles.metaPillText}>
              {store?.name || "Unknown"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.iconWrap}>
          <AppIcon
            name={product.iconName || DEFAULT_PRODUCT_ICON}
            variant="community"
            size={98}
            color={iconColor}
          />
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>{product.name}</Text>

          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={handleFavoritePress}
            activeOpacity={0.85}
          >
            <View style={styles.favoriteIconWrap}>
              <Animated.View
                style={[
                  styles.favoriteIconLayer,
                  {
                    opacity: favoriteAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0],
                    }),
                    transform: [
                      {
                        scale: favoriteAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0.9],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <AppIcon
                  name="heart-outline"
                  variant="community"
                  size={FAVORITE_ICON_SIZE}
                  color={colors.text}
                />
              </Animated.View>

              <Animated.View
                style={[
                  styles.favoriteIconLayer,
                  {
                    opacity: favoriteAnim,
                    transform: [
                      {
                        scale: favoriteAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.9, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <AppIcon
                  name="heart"
                  variant="community"
                  size={FAVORITE_ICON_SIZE}
                  color="#D32F2F"
                />
              </Animated.View>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.price}>${product.price}</Text>

        {product.description ? (
          <Text style={styles.description}>{product.description}</Text>
        ) : null}
      </ScrollView>

      <View style={[styles.actionsFooter, { paddingBottom: insets.bottom }]}>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, isInCart && styles.goToCartButton]}
            onPress={handlePrimaryCartAction}
          >
            <AppIcon
              name={isInCart ? "basket" : "basket-plus"}
              variant="community"
              size={19}
              color={isInCart ? styles.goToCartText.color : colors.text}
            />
            <Text style={[styles.secondaryButtonText, isInCart && styles.goToCartText]}>
              {isInCart ? "Go to cart" : "Add to Cart"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleQuickBuy}>
            <AppIcon
              name="credit-card-fast-outline"
              variant="community"
              size={19}
              color={colors.background}
            />
            <Text style={styles.buttonText}>Quick buy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      paddingBottom: 12,
    },
    metaPillsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 12,
    },
    metaArrowChip: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.screen,
      alignItems: "center",
      justifyContent: "center",
    },
    metaPill: {
      maxWidth: "72%",
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
    },
    metaPillText: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.textMuted,
      maxWidth: 180,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
      gap: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
    },
    iconWrap: {
      marginTop: 40,
      marginBottom: 50,
      alignItems: "center",
      justifyContent: "center",
    },
    price: {
      fontSize: 22,
      fontWeight: "700",
      textAlign: "left",
      marginBottom: 12,
      color: colors.text,
    },
    button: {
      backgroundColor: colors.text,
      height: 48,
      flex: 1,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    buttonText: {
      color: colors.background,
      fontWeight: "600",
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      height: 48,
      flex: 1,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: "600",
    },
    goToCartButton: {
      backgroundColor: colors.successSoft,
      borderWidth: 0,
    },
    goToCartText: {
      color: colors.success,
    },
    favoriteButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    favoriteIconWrap: {
      width: FAVORITE_ICON_WRAP_SIZE,
      height: FAVORITE_ICON_WRAP_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    favoriteIconLayer: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
    },
    description: {
      marginTop: 14,
      marginBottom: 20,
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 21,
    },
    actionsFooter: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
      backgroundColor: colors.background,
      paddingTop: 10,
      paddingHorizontal: 16,
    },
    actionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
  });
