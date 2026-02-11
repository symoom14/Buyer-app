import { StyleSheet, Text, View } from "react-native";

export default function MerchantStoresAnalytics() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Store analytics</Text>
      <Text style={styles.meta}>
        Analytics will appear here once connected.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F2F2F7",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  meta: {
    color: "#666",
  },
});
