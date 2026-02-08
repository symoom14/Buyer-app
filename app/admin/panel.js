import { StyleSheet, Text, View } from "react-native";
import LogoutButton from "../../src/components/LogoutButton";

export default function AdminPanel() {
  return (
    (
      <View style={styles.container}>
        <Text style={styles.title}>Admin Panel</Text>
        <Text>Manage stores, products, orders</Text>
      </View>
    ),
    (
      <View style={styles.container}>
        <Text style={styles.title}>Admin Panel</Text>
        <Text>Manage stores, products, orders</Text>

        <LogoutButton />
      </View>
    )
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
  },
});
