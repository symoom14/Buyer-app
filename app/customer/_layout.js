import { Ionicons } from "@expo/vector-icons";
import { Stack, usePathname, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import FloatingCartButton from "../../src/components/FloatingCartButton";
import { useAppTheme } from "../../src/theme/useAppTheme";

export default function CustomerLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useAppTheme();

  const hideCartButton =
    pathname.includes("/customer/home") ||
    pathname === "/customer" ||
    pathname.includes("/customer/cart") ||
    pathname.includes("/customer/checkout") ||
    pathname.includes("/customer/invoice") ||
    pathname.includes("/customer/profile");

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.customerHeaderBg,
          },
          headerTintColor: colors.customerHeaderText,
          headerTitleStyle: {
            fontWeight: "600",
          },
        }}
      >
        <Stack.Screen
          name="home"
          options={{
            headerShown: false,
            title: "Home",
            headerRight: () => (
              <Pressable onPress={() => router.push("/customer/profile")}>
                <Ionicons
                  name="person-outline"
                  size={22}
                  color={colors.customerHeaderText}
                />
              </Pressable>
            ),
          }}
        />

        <Stack.Screen name="profile" options={{ title: "Profile" }} />
        <Stack.Screen
          name="notifications"
          options={{ title: "Notifications" }}
        />
        <Stack.Screen name="product" options={{ title: "Latest Products" }} />
        <Stack.Screen
          name="product/[productId]"
          options={{ title: "Product Details" }}
        />
        <Stack.Screen name="store" options={{ title: "Browse Stores" }} />
        <Stack.Screen
          name="store/[storeId]"
          options={{ title: "Store Products" }}
        />
        <Stack.Screen
          name="seller/[sellerId]"
          options={{ title: "Seller Stores" }}
        />
        <Stack.Screen
          name="in-progress"
          options={{ title: "In progress" }}
        />
        <Stack.Screen
          name="completed-orders"
          options={{ title: "Completed orders" }}
        />
        <Stack.Screen
          name="cancelled-orders"
          options={{ title: "Cancelled orders" }}
        />
        <Stack.Screen
          name="orders/[orderId]"
          options={{ title: "Order Details" }}
        />
        <Stack.Screen name="orders" options={{ title: "All orders" }} />
        <Stack.Screen
          name="saved-products"
          options={{ title: "Saved products" }}
        />
        <Stack.Screen name="cart" options={{ title: "Cart" }} />
        <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
        <Stack.Screen name="invoice/[orderId]" options={{ title: "Invoice" }} />
      </Stack>

      {!hideCartButton && <FloatingCartButton />}
    </View>
  );
}
