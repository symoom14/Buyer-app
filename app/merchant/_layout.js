import { Stack } from "expo-router";

export default function MerchantLayout() {
  return (
    <Stack>
      {/* Merchant home dashboard */}
      <Stack.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          headerBackVisible: false,
        }}
      />

      {/* Stores management */}
      <Stack.Screen
        name="stores"
        options={{
          title: "My Stores",
        }}
      />

      {/* Orders */}
      <Stack.Screen
        name="orders"
        options={{
          title: "Orders",
        }}
      />

      {/* Store page */}
      <Stack.Screen
        name="store/[storeId]"
        options={{
          title: "Store",
        }}
      />

      {/* Add Product */}
      <Stack.Screen
        name="store/add-product/[storeId]"
        options={{
          title: "Add Product",
        }}
      />
    </Stack>
  );
}
