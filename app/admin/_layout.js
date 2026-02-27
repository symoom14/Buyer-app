import { Redirect, Stack, usePathname } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import AdminQuickNavBar from "../../src/components/AdminQuickNavBar";
import { useAuth } from "../../src/context/AuthContext";
import { useAppTheme } from "../../src/theme/useAppTheme";

export default function AdminLayout() {
  const pathname = usePathname();
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
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
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
          <Stack.Screen
            name="products"
            options={{
              title: "All Products",
            }}
          />
          <Stack.Screen
            name="orders"
            options={{
              title: "All Orders",
            }}
          />
          <Stack.Screen
            name="merchant-performance"
            options={{
              title: "Merchant Performance",
            }}
          />
          <Stack.Screen
            name="profile"
            options={{
              title: "Profile",
            }}
          />
          <Stack.Screen
            name="logs"
            options={{
              title: "Activity Log",
            }}
          />
          <Stack.Screen
            name="merchant/[merchantId]/pending-orders"
            options={{
              title: "Pending Orders",
            }}
          />
          <Stack.Screen
            name="store/[storeId]"
            options={{
              title: "Store Products",
            }}
          />
          <Stack.Screen
            name="store/edit-product/[productId]"
            options={{
              title: "Edit Product",
            }}
          />
          <Stack.Screen
            name="store/add-product/[storeId]"
            options={{
              title: "Add Product",
            }}
          />
        </Stack>
      </View>
      <AdminQuickNavBar pathname={pathname} />
    </View>
  );
}
