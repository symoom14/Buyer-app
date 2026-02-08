import { useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import ScreenContainer from "../../../src/components/ScreenContainer";
import { useCart } from "../../../src/context/CartContext";
import { db } from "../../../src/firebase/firebaseConfig";

export default function ProductDetails() {
  const params = useLocalSearchParams();
  const productId = Array.isArray(params.productId)
    ? params.productId[0]
    : params.productId;

  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [store, setStore] = useState(null);
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

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
      merchantName: merchant?.username || "Unknown merchant",
    });
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

      <Text style={styles.meta}>Store: {store?.name}</Text>
      <Text style={styles.meta}>Seller: {merchant?.username}</Text>

      {/* Product description (only if it exists) */}
      {product.description ? (
        <Text style={styles.description}>{product.description}</Text>
      ) : null}

      {/* Price in bold */}
      <Text style={styles.price}>${product.price}</Text>

      <TouchableOpacity style={styles.button} onPress={handleAddToCart}>
        <Text style={styles.buttonText}>Add to Cart</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  meta: {
    color: "#555",
    marginBottom: 4,
  },
  description: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 15,
    lineHeight: 20,
    color: "#333",
  },
  price: {
    fontSize: 18,
    fontWeight: "700",
    marginVertical: 12,
  },
  button: {
    backgroundColor: "#000",
    padding: 14,
    borderRadius: 6,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
