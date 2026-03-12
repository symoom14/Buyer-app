import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";

export default function Index() {
  const { user, role, loading } = useAuth();
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase();


  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }


  if (!user) {
    return <Redirect href="/login" />;
  }


  if (normalizedRole === "customer") {
    return <Redirect href="/customer/home" />;
  }

  if (normalizedRole === "merchant") {
    return <Redirect href="/merchant/dashboard" />;
  }

  if (normalizedRole === "admin") {
    return <Redirect href="/admin/panel" />;
  }


  return null;
}
