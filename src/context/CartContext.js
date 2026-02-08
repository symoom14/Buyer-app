import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

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
      const existing = prev.find((p) => p.productId === product.productId);
      if (existing) {
        return prev.map((p) =>
          p.productId === product.productId
            ? { ...p, quantity: p.quantity + 1 }
            : p,
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const increment = (productId) => {
    setCart((prev) =>
      prev.map((p) =>
        p.productId === productId ? { ...p, quantity: p.quantity + 1 } : p,
      ),
    );
  };

  const decrement = (productId) => {
    setCart((prev) =>
      prev
        .map((p) =>
          p.productId === productId ? { ...p, quantity: p.quantity - 1 } : p,
        )
        .filter((p) => p.quantity > 0),
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((p) => p.productId !== productId));
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
