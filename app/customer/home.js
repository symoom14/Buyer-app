import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppIcon from "../../src/components/AppIcon";
import DashboardSection from "../../src/components/DashboardSection";
import ScreenContainer from "../../src/components/ScreenContainer";
import { useCart } from "../../src/context/CartContext";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";

export default function CustomerHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart } = useCart();
  const { colors } = useAppTheme();
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const styles = createStyles(colors);

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

  return (
    <ScreenContainer>
      {/* Fake header */}
      <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
        <View style={styles.heroRow}>
          <Text style={styles.heroTitle}>Buyer</Text>

          <View style={styles.headerActions}>
            {cart.length > 0 ? (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push("/customer/cart")}
              >
                <Ionicons name="basket" size={30} color={colors.customerHeaderText} />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push("/customer/notifications")}
            >
              <AppIcon
                name={hasUnreadNotifications ? "bell-badge" : "bell"}
                variant="community"
                size={26}
                color={colors.customerHeaderText}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push("/customer/profile")}
            >
              <Ionicons
                name="person-circle-outline"
                size={30}
                color={colors.customerHeaderText}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Dashboard content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <DashboardSection
          title="Browse"
          tiles={[
            {
              title: "Latest products",
              onPress: () => router.push("/customer/product"),
              icon: "package-variant",
              iconVariant: "community",
              backgroundColor: "#FFD8B0",
              iconColor: "#A34300",
              textColor: "#6C2C00",
            },
            {
              title: "Browse stores",
              onPress: () => router.push("/customer/store"),
              icon: "store",
              iconVariant: "community",
              backgroundColor: "#DFF2FF",
              iconColor: "#0B6BE0",
              textColor: "#0A4AA3",
            },
          ]}
        />

        <DashboardSection
          title="Your orders"
          layout="grid"
          tiles={[
            {
              title: "Recent orders",
              onPress: () => router.push("/customer/orders"),
              icon: "receipt-clock",
              iconVariant: "community",
              backgroundColor: "#FFE7D6",
              iconColor: "#C04A00",
              textColor: "#8A3400",
            },
            {
              title: "In progress",
              onPress: () => router.push("/customer/in-progress"),
              icon: "progress-clock",
              iconVariant: "community",
              backgroundColor: "#F2E8FF",
              iconColor: "#6B2DE0",
              textColor: "#4A1EA3",
            },
            {
              title: "Completed orders",
              onPress: () => router.push("/customer/completed-orders"),
              icon: "receipt-text-check",
              iconVariant: "community",
              backgroundColor: "#E8F7EC",
              iconColor: "#1E8E3E",
              textColor: "#146C2E",
            },
            {
              title: "Cancelled orders",
              onPress: () => router.push("/customer/cancelled-orders"),
              icon: "close-box",
              iconVariant: "community",
              backgroundColor: "#FDE4E4",
              iconColor: "#C62828",
              textColor: "#8E1C1C",
            },
          ]}
        />

        <DashboardSection
          title="Favourites"
          tiles={[
            {
              title: "Saved products",
              onPress: () => router.push("/customer/saved-products"),
              icon: "heart",
              iconVariant: "community",
              backgroundColor: "#FFE0E6",
              iconColor: "#C62828",
              textColor: "#8E1C1C",
            },
            {
              title: "Saved stores",
              icon: "store-check",
              iconVariant: "community",
              backgroundColor: "#E7F6FF",
              iconColor: "#1565C0",
              textColor: "#0D47A1",
            },
          ]}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  hero: {
    backgroundColor: colors.customerHeaderBg,
    marginHorizontal: -16,
    marginTop: -16,
    paddingHorizontal: 16,
    paddingBottom: 50,
    marginBottom: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: "800",
    color: colors.customerHeaderText,
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
});
