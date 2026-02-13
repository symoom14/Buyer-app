import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import LottieView from "lottie-react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "../../src/components/AppIcon";
import ScreenContainer from "../../src/components/ScreenContainer";
import { useCart } from "../../src/context/CartContext";
import { auth, db } from "../../src/firebase/firebaseConfig";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, clearCart } = useCart();
  const [isPaying, setIsPaying] = useState(false);
  const [animationStage, setAnimationStage] = useState("payment");
  const [animationCompleted, setAnimationCompleted] = useState(false);
  const [pendingInvoiceId, setPendingInvoiceId] = useState(null);
  const [cartSnapshot, setCartSnapshot] = useState([]);

  const visibleCart = isPaying ? cartSnapshot : cart;
  const total = visibleCart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  useEffect(() => {
    if (!animationCompleted || !pendingInvoiceId) return;
    router.replace(`/customer/invoice/${pendingInvoiceId}`);
  }, [animationCompleted, pendingInvoiceId, router]);

  const handlePay = async () => {
    try {
      if (!cart.length) {
        throw new Error("Cart is empty");
      }
      setCartSnapshot(cart);
      setIsPaying(true);
      setAnimationStage("payment");
      setAnimationCompleted(false);
      setPendingInvoiceId(null);

      const orderRef = await addDoc(collection(db, "orders"), {
        customerId: auth.currentUser.uid,
        items: cart.map((item) => ({
          productId: item.productId,
          name: item.name,
          merchantId: item.merchantId,
          merchantName: item.merchantName,
          quantity: Number(item.quantity),
          price: Number(item.price),
        })),
        total: Number(total),
        paymentMethod: "Credit card ending 1234",
        createdAt: serverTimestamp(),
      });

      clearCart();
      setPendingInvoiceId(orderRef.id);
    } catch (err) {
      console.error("Checkout failed:", err.message);
      setCartSnapshot([]);
      setIsPaying(false);
      setAnimationStage("payment");
      setAnimationCompleted(false);
      setPendingInvoiceId(null);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Checkout</Text>

      <View style={styles.itemsCard}>
        {visibleCart.map((item, index) => (
          <View
            key={item.productId}
            style={[
              styles.itemRow,
              index !== visibleCart.length - 1 && styles.itemRowDivider,
            ]}
          >
            <View style={styles.itemLeft}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.name}</Text>
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyBadgeText}>{item.quantity}</Text>
                </View>
              </View>
              <View style={styles.sellerStoreRow}>
                <Text style={styles.sellerStoreText}>
                  {item.merchantName || "Unknown seller"}
                </Text>
                <View style={styles.arrowChip}>
                  <AppIcon
                    name="chevron-right"
                    variant="community"
                    size={14}
                    color="#5C5C5C"
                  />
                </View>
                <Text style={styles.sellerStoreText}>
                  {item.storeName || "Unknown store"}
                </Text>
              </View>
            </View>
            <Text style={styles.itemAmount}>
              ${(item.price * item.quantity).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
      </View>

      {isPaying ? (
        <View style={styles.payAnimationWrap}>
          <LottieView
            source={
              animationStage === "payment"
                ? require("../../assets/lottie/payment.json")
                : require("../../assets/lottie/success-check.json")
            }
            autoPlay
            loop={false}
            onAnimationFinish={() => {
              if (animationStage === "payment") {
                setAnimationStage("success");
                return;
              }
              setAnimationCompleted(true);
            }}
            style={[
              styles.payAnimation,
              animationStage === "success" && styles.successAnimation,
            ]}
          />
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.payButton, cart.length === 0 && styles.disabled]}
          disabled={cart.length === 0}
          onPress={handlePay}
        >
          <AppIcon
            name="contactless-payment-circle-outline"
            variant="community"
            size={20}
            color="#fff"
          />
          <Text style={styles.payText}>Pay ${total.toFixed(2)}</Text>
        </TouchableOpacity>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  itemsCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EAEAEA",
    borderRadius: 12,
    overflow: "hidden",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  itemLeft: {
    flex: 1,
    paddingRight: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sellerStoreRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F1F1F",
  },
  qtyBadge: {
    backgroundColor: "#E7F1FF",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F5FBF",
  },
  sellerStoreText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  arrowChip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  itemAmount: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
  },
  totalRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  payButton: {
    backgroundColor: "#000",
    padding: 16,
    width: "80%",
    alignSelf: "center",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 40,
  },
  payText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  payAnimationWrap: {
    width: "100%",
    alignSelf: "center",
    marginTop: 40,
    height: 144,
    alignItems: "center",
    justifyContent: "center",
  },
  payAnimation: {
    width: "100%",
    height: "100%",
  },
  successAnimation: {
    transform: [{ scale: 0.85 }],
  },
  disabled: {
    backgroundColor: "#999",
  },
});
