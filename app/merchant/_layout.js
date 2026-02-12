import { Stack } from "expo-router";

export default function MerchantLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#0b6be0",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "700",
        },
      }}
    >
      {/* Merchant home dashboard */}
      <Stack.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          headerShown: false,
          headerBackVisible: false,
        }}
      />
      <Stack.Screen name="profile" options={{ title: "Profile" }} />

      {/* Stores management */}
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

      {/* Orders */}
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

      {/* Store page */}
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

      {/* Add Product */}
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
  );
}
