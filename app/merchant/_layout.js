import { Stack, usePathname } from "expo-router";
import { View } from "react-native";
import MerchantQuickNavBar from "../../src/components/MerchantQuickNavBar";
import { useAppTheme } from "../../src/theme/useAppTheme";

export default function MerchantLayout() {
  const pathname = usePathname();
  const { colors } = useAppTheme();

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.merchantHeaderBg,
            },
            headerTintColor: colors.merchantHeaderText,
            headerTitleStyle: {
              fontWeight: "700",
            },
          }}
        >
          
          <Stack.Screen
            name="dashboard"
            options={{
              title: "Dashboard",
              headerShown: false,
              headerBackVisible: false,
            }}
          />
          <Stack.Screen name="profile" options={{ title: "Profile" }} />
          <Stack.Screen name="notifications" options={{ title: "Notifications" }} />

          
          <Stack.Screen
            name="stores/manage"
            options={{
              title: "Manage Stores",
            }}
          />
          <Stack.Screen
            name="stores/products"
            options={{
              title: "All Products",
            }}
          />
          <Stack.Screen
            name="stores/add"
            options={{
              title: "Add Store",
            }}
          />
          <Stack.Screen
            name="stores/analytics"
            options={{
              title: "Store Analytics",
            }}
          />

          
          <Stack.Screen
            name="orders"
            options={{
              title: "Orders",
            }}
          />
          <Stack.Screen
            name="orders/[orderId]"
            options={{
              title: "Order Details",
            }}
          />

          
          <Stack.Screen
            name="store/[storeId]"
            options={{
              title: "Store",
            }}
          />
          <Stack.Screen
            name="restock"
            options={{
              title: "Restock",
            }}
          />

          
          <Stack.Screen
            name="store/add-product/[storeId]"
            options={{
              title: "Add Product",
            }}
          />
          <Stack.Screen
            name="store/edit-product/[productId]"
            options={{
              title: "Edit Product",
            }}
          />
        </Stack>
      </View>

      <MerchantQuickNavBar pathname={pathname} />
    </View>
  );
}
