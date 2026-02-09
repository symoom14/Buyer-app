import { Ionicons } from "@expo/vector-icons";
import { Stack, usePathname, useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import FloatingCartButton from "../../src/components/FloatingCartButton";

export default function CustomerLayout() {
  const pathname = usePathname();
  const router = useRouter();

  const hideCartButton =
    pathname.includes("/customer/cart") ||
    pathname.includes("/customer/checkout") ||
    pathname.includes("/customer/invoice") ||
    pathname.includes("/customer/profile");

  return (
    <View style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen
          name="home"
          options={{
            title: "Home",
            headerBackVisible: false,
            headerRight: () => (
              <Pressable
                onPress={() => router.push("/customer/profile")}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: 2.25,
                }}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={28}
                  color="#007AFF"
                />
              </Pressable>
            ),
          }}
        />

        <Stack.Screen name="profile" options={{ title: "Profile" }} />

        <Stack.Screen
          name="product/[productId]"
          options={{ title: "Product Details" }}
        />

        <Stack.Screen name="cart" options={{ title: "Your Cart" }} />

        <Stack.Screen name="checkout" options={{ title: "Checkout" }} />

        <Stack.Screen name="invoice/[orderId]" options={{ title: "Invoice" }} />
      </Stack>

      {!hideCartButton && <FloatingCartButton />}
    </View>
  );
}
