import { Stack } from "expo-router";

export default function CustomerLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="home"
        options={{
          title: "Home",
          headerBackVisible: false,
        }}
      />

      <Stack.Screen
        name="product/[productId]"
        options={{
          title: "Product Details",
        }}
      />
    </Stack>
  );
}
