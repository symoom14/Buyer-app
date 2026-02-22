import { StyleSheet, Text, View } from "react-native";
import LogoutButton from "../../src/components/LogoutButton";
import { useAppTheme } from "../../src/theme/useAppTheme";

export default function AdminPanel() {
  const { colors, isDark } = useAppTheme();

  return (
    (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, isDark ? { color: colors.text } : null]}>
          Admin Panel
        </Text>
        <Text style={{ color: colors.text }}>
          Manage stores, products, orders
        </Text>
      </View>
    ),
    (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, isDark ? { color: colors.text } : null]}>
          Admin Panel
        </Text>
        <Text style={{ color: colors.text }}>
          Manage stores, products, orders
        </Text>

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
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
  },
});
