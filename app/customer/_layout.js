import { Stack, usePathname } from "expo-router";
import FloatingCartButton from "../../src/components/FloatingCartButton";

export default function CustomerLayout() {
  const pathname = usePathname();

  const hideCartButton =
    pathname.includes("/customer/cart") ||
    pathname.includes("/customer/checkout") ||
    pathname.includes("/customer/invoice");

  return (
    <>
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

        <Stack.Screen
          name="cart"
          options={{
            title: "Your Cart",
          }}
        />

        <Stack.Screen
          name="checkout"
          options={{
            title: "Checkout",
          }}
        />

        <Stack.Screen
          name="invoice/[orderId]"
          options={{
            title: "Invoice",
          }}
        />
      </Stack>

      {!hideCartButton && <FloatingCartButton />}
    </>
  );
}
