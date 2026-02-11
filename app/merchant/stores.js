import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import DashboardSection from "../../src/components/DashboardSection";
import ScreenContainer from "../../src/components/ScreenContainer";

export default function MerchantStoresScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>My Stores</Text>

        <DashboardSection
          title="Store actions"
          layout="grid"
          tiles={[
            {
              title: "View and manage stores",
              onPress: () => router.push("/merchant/stores/manage"),
              icon: "store",
              iconVariant: "community",
              backgroundColor: "#DFF2FF",
              iconColor: "#0B6BE0",
              textColor: "#0A4AA3",
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
              title: "Store analytics",
              onPress: () => router.push("/merchant/stores/analytics"),
              icon: "chart-line",
              iconVariant: "community",
              backgroundColor: "#F2E8FF",
              iconColor: "#6B2DE0",
              textColor: "#4A1EA3",
            },
          ]}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 12,
  },
});
