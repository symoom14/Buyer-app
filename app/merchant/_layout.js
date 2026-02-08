import { Stack } from "expo-router";

export default function MerchantLayout() {
  return (
    <Stack>
      {/* Root merchant screen */}
      <Stack.Screen
        name="dashboard"
        options={{
          title: "My Stores",
          headerBackVisible: false,
        }}
      />

      {/* Store page */}
      <Stack.Screen
        name="store/[storeId]"
        options={{
          title: "Store",
        }}
      />

      {/* Add Product page */}
      <Stack.Screen
        name="store/add-product/[storeId]"
        options={{
          title: "Add Product",
        }}
      />
    </Stack>
  );
}
