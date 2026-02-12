import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DashboardSection from "../../src/components/DashboardSection";
import ScreenContainer from "../../src/components/ScreenContainer";

export default function MerchantDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScreenContainer>
      <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
        <View style={styles.heroRow}>
          <Text style={styles.heroTitle}>Merchant</Text>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push("/merchant/profile")}
          >
            <Ionicons name="person-circle-outline" size={30} color="#fff" />
          </TouchableOpacity>
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
              title: "View all products",
              onPress: () => router.push("/merchant/stores/products"),
              icon: "format-list-bulleted",
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
              title: "Orders",
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
              icon: "chart-line",
              iconVariant: "community",
              backgroundColor: "#F2E8FF",
              iconColor: "#6B2DE0",
              textColor: "#4A1EA3",
            },
            {
              title: "Earnings analytics",
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

const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#0b6be0",
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
    color: "#fff",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileBtn: {
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
