import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import LogoutButton from "../../src/components/LogoutButton";

export default function MerchantDashboard() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.card}
        onPress={() => router.push("/merchant/stores")}
      >
        <Ionicons name="storefront-outline" size={28} color="#007AFF" />
        <Text style={styles.cardTitle}>My Stores</Text>
        <Text style={styles.cardSubtitle}>
          Manage stores, products, and availability
        </Text>
      </Pressable>

      <Pressable
        style={styles.card}
        onPress={() => router.push("/merchant/orders")}
      >
        <Ionicons name="receipt-outline" size={28} color="#007AFF" />
        <Text style={styles.cardTitle}>Orders</Text>
        <Text style={styles.cardSubtitle}>
          View customer orders across all stores
        </Text>
      </Pressable>
      <LogoutButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F2F2F7",
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
});
