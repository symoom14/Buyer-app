import { useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FloatingCartButton from "../../../src/components/FloatingCartButton";
import ScreenContainer from "../../../src/components/ScreenContainer";
import { useCart } from "../../../src/context/CartContext";
import { db } from "../../../src/firebase/firebaseConfig";

export default function ProductDetails() {
  const { productId } = useLocalSearchParams();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      const snap = await getDoc(doc(db, "products", productId));
      if (snap.exists()) {
        setProduct({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    };

    fetchProduct();
  }, [productId]);

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size="large" />
      </ScreenContainer>
    );
  }

  if (!product) {
    return (
      <ScreenContainer>
        <Text>Product not found.</Text>
      </ScreenContainer>
    );
  }

  const handleAddToCart = () => {
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      storeId: product.storeId,
    });
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.name}>{product.name}</Text>

        <Text style={styles.price}>${product.price}</Text>

        {product.category && (
          <Text style={styles.meta}>Category: {product.category}</Text>
        )}

        {product.description && (
          <Text style={styles.description}>{product.description}</Text>
        )}

        <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
          <Text style={styles.addButtonText}>Add to Cart</Text>
        </TouchableOpacity>
      </View>

      {/* Floating persistent cart button */}
      <FloatingCartButton />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: "500",
    marginBottom: 12,
  },
  meta: {
    color: "#666",
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: "#000",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
