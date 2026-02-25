import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { useAppTheme } from "../../src/theme/useAppTheme";

export default function AdminLayout() {
  const { user, role, loading } = useAuth();
  const { colors } = useAppTheme();
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.danger} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (normalizedRole !== "admin") {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.danger,
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: {
          fontWeight: "700",
        },
      }}
    >
      <Stack.Screen
        name="panel"
        options={{
          title: "Admin Dashboard",
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="users"
        options={{
          title: "All Users",
        }}
      />
      <Stack.Screen
        name="stores"
        options={{
          title: "All Stores",
        }}
      />
    </Stack>
  );
}
