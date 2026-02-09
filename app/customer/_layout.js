import { Ionicons } from "@expo/vector-icons";
import { Stack, usePathname, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import FloatingCartButton from "../../src/components/FloatingCartButton";

export default function CustomerLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const hideCartButton =
    pathname.includes("/customer/cart") ||
    pathname.includes("/customer/checkout") ||
    pathname.includes("/customer/invoice") ||
    pathname.includes("/customer/profile");

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#FFC107",
          },
          headerTintColor: "#000",
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
                <Ionicons name="person-outline" size={22} color="#000" />
              </Pressable>
            ),
          }}
        />

        <Stack.Screen name="profile" options={{ title: "Profile" }} />
        <Stack.Screen
          name="product/[productId]"
          options={{ title: "Product Details" }}
        />
        <Stack.Screen name="cart" options={{ title: "Cart" }} />
        <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
        <Stack.Screen name="invoice/[orderId]" options={{ title: "Invoice" }} />
      </Stack>

      {!hideCartButton && <FloatingCartButton />}
    </View>
  );
}
