import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import { getCartItemKey } from "../utils/productVariants";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem("cart").then((data) => {
      if (data) setCart(JSON.parse(data));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product) => {
    setCart((prev) => {
      const cartItemKey =
        product.cartItemKey ||
        getCartItemKey(product.productId, product.selectedOptions);
      const existing = prev.find(
        (p) =>
          (p.cartItemKey && p.cartItemKey === cartItemKey) ||
          (!p.cartItemKey && p.productId === product.productId),
      );
      if (existing) {
        return prev.map((p) =>
          ((p.cartItemKey && p.cartItemKey === cartItemKey) ||
            (!p.cartItemKey && p.productId === product.productId))
            ? { ...p, quantity: p.quantity + 1 }
            : p,
        );
      }
      return [...prev, { ...product, cartItemKey, quantity: 1 }];
    });
  };

  const increment = (cartItemKey) => {
    setCart((prev) =>
      prev.map((p) =>
        ((p.cartItemKey && p.cartItemKey === cartItemKey) ||
          (!p.cartItemKey && p.productId === cartItemKey))
          ? { ...p, quantity: p.quantity + 1 }
          : p,
      ),
    );
  };

  const decrement = (cartItemKey) => {
    setCart((prev) =>
      prev
        .map((p) =>
          ((p.cartItemKey && p.cartItemKey === cartItemKey) ||
            (!p.cartItemKey && p.productId === cartItemKey))
            ? { ...p, quantity: p.quantity - 1 }
            : p,
        )
        .filter((p) => p.quantity > 0),
    );
  };

  const removeFromCart = (cartItemKey) => {
    setCart((prev) =>
      prev.filter(
        (p) =>
          !(
            (p.cartItemKey && p.cartItemKey === cartItemKey) ||
            (!p.cartItemKey && p.productId === cartItemKey)
          ),
      ),
    );
  };

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        increment,
        decrement,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
