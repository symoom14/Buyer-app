import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";

export default function Index() {
  const { user, role, loading } = useAuth();

  // Still checking Firebase auth state
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Not logged in -> go to login
  if (!user) {
    return <Redirect href="/login" />;
  }

  // Logged in -> route by role
  if (role === "customer") {
    return <Redirect href="/customer/home" />;
  }

  if (role === "merchant") {
    return <Redirect href="/merchant/dashboard" />;
  }

  if (role === "admin") {
    return <Redirect href="/admin/panel" />;
  }

  // Fallback
  return null;
}
