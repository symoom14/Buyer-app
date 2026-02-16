import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AppIcon from "../../../src/components/AppIcon";
import ScreenContainer from "../../../src/components/ScreenContainer";
import { useCart } from "../../../src/context/CartContext";
import { useFavorites } from "../../../src/context/FavoritesContext";
import { db } from "../../../src/firebase/firebaseConfig";
import { getUserDisplayName } from "../../../src/utils/userDisplayName";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const FAVORITE_ICON_SIZE = 25;
const FAVORITE_ICON_WRAP_SIZE = FAVORITE_ICON_SIZE + 10;
const ICON_COLOR_POOL = [
  "#E53935", // red
  "#2E7D32", // green
  "#1E88E5", // blue
  "#FFA700", // chrome yellow
  "#F57C00", // orange
  "#111111", // black
];

export default function ProductDetails() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const productId = Array.isArray(params.productId)
    ? params.productId[0]
    : params.productId;

  const { addToCart } = useCart();
  const { hasFavorite, toggleFavorite } = useFavorites();

  const [product, setProduct] = useState(null);
  const [store, setStore] = useState(null);
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const favoriteAnim = useRef(new Animated.Value(0)).current;
  const isFavorite = hasFavorite(productId);
  const iconColor = useMemo(() => {
    const idx = Math.floor(Math.random() * ICON_COLOR_POOL.length);
    return ICON_COLOR_POOL[idx];
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    Animated.timing(favoriteAnim, {
      toValue: isFavorite ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [favoriteAnim, isFavorite]);

  const fetchData = async () => {
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
  };

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

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size="large" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>{product.name}</Text>

      <View style={styles.iconWrap}>
        <AppIcon
          name={product.iconName || DEFAULT_PRODUCT_ICON}
          variant="community"
          size={98}
          color={iconColor}
        />
      </View>

      <Text style={styles.price}>${product.price}</Text>

      {product.description ? (
        <Text style={styles.description}>{product.description}</Text>
      ) : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.button} onPress={handleAddToCart}>
          <AppIcon
            name="basket-plus"
            variant="community"
            size={19}
            color="#fff"
          />
          <Text style={styles.buttonText}>Add to Cart</Text>
        </TouchableOpacity>

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
                color="#111"
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

      <View style={styles.gap} />

      <View style={styles.infoBox}>
        <View style={styles.infoRow}>
          <Text style={styles.meta}>
            Store:{" "}
            <Text style={styles.metaValue}>{store?.name || "Unknown"}</Text>
          </Text>
          <TouchableOpacity
            style={styles.pill}
            onPress={() => router.push(`/customer/store/${product.storeId}`)}
          >
            <Text style={styles.pillText}>Visit store</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.meta}>
            Seller:{" "}
            <Text style={styles.metaValue}>
              {getUserDisplayName(merchant, "Unknown")}
            </Text>
          </Text>
          <TouchableOpacity style={styles.pill} onPress={() => {}}>
            <Text style={styles.pillText}>Visit seller</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 12,
  },
  meta: {
    color: "#555",
    fontSize: 14,
  },
  metaValue: {
    fontWeight: "600",
    color: "#222",
  },
  iconWrap: {
    marginTop: 8,
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  price: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "left",
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  button: {
    backgroundColor: "#000",
    height: 48,
    flex: 1,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  favoriteButton: {
    width: 52,
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d1d1d6",
    backgroundColor: "#fff",
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
    color: "#333",
    fontSize: 15,
    lineHeight: 21,
  },
  gap: {
    height: 34,
  },
  infoBox: {
    borderWidth: 1,
    borderColor: "#e5e5ea",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pill: {
    backgroundColor: "#f2f2f7",
    borderWidth: 1,
    borderColor: "#d1d1d6",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
});
