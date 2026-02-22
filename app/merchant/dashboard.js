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
import { auth, db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";

export default function MerchantDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
            (docSnap) => docSnap.data()?.recipientRole === "merchant",
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
      <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
        <View style={styles.heroRow}>
          <Text style={styles.heroTitle}>Merchant</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push("/merchant/notifications")}
            >
              <AppIcon
                name={hasUnreadNotifications ? "bell-badge" : "bell"}
                variant="community"
                size={26}
                color={colors.merchantHeaderText}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push("/merchant/profile")}
            >
              <Ionicons
                name="person-circle-outline"
                size={30}
                color={colors.merchantHeaderText}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <DashboardSection
          title="My stores"
          layout="grid"
          tiles={[
            {
              title: "View and manage existing stores",
              onPress: () => router.push("/merchant/stores/manage"),
              icon: "store",
              iconVariant: "community",
              backgroundColor: "#DFF2FF",
              iconColor: "#0b6be0",
              textColor: "#0A4AA3",
            },
            {
              title: "Add new store",
              onPress: () => router.push("/merchant/stores/add"),
              icon: "store-plus",
              iconVariant: "community",
              backgroundColor: "#FFF1CC",
              iconColor: "#9C6B00",
              textColor: "#6B4A00",
            },
            {
              title: "Product management",
              onPress: () => router.push("/merchant/stores/products"),
              icon: "archive-cog",
              iconVariant: "community",
              backgroundColor: "#E8F7EC",
              iconColor: "#1E8E3E",
              textColor: "#146C2E",
            },
          ]}
        />

        <DashboardSection
          title="Orders"
          tiles={[
            {
              title: "View orders",
              onPress: () => router.push("/merchant/orders"),
              icon: "receipt-text",
              iconVariant: "community",
              backgroundColor: "#FFF1CC",
              iconColor: "#9C6B00",
              textColor: "#6B4A00",
            },
          ]}
        />

        <DashboardSection
          title="Analytics"
          tiles={[
            {
              title: "Store analytics",
              onPress: () => router.push("/merchant/stores/analytics?mode=store"),
              icon: "chart-line",
              iconVariant: "community",
              backgroundColor: "#F2E8FF",
              iconColor: "#6B2DE0",
              textColor: "#4A1EA3",
            },
            {
              title: "Earnings analytics",
              onPress: () =>
                router.push("/merchant/stores/analytics?mode=earnings"),
              icon: "finance",
              iconVariant: "community",
              backgroundColor: "#E8F7EC",
              iconColor: "#1E8E3E",
              textColor: "#146C2E",
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
    backgroundColor: colors.merchantHeaderBg,
    marginHorizontal: -16,
    marginTop: -16,
    paddingHorizontal: 16,
    paddingBottom: 50,
    marginBottom: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: "800",
    color: colors.merchantHeaderText,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
