import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "../firebase/firebaseConfig";

const FavoritesContext = createContext(null);

function getFavoritesKey(uid) {
  return `favorites:${uid || "guest"}`;
}

export function FavoritesProvider({ children }) {
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [storageKey, setStorageKey] = useState(getFavoritesKey(null));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setReady(false);
      setStorageKey(getFavoritesKey(user?.uid || null));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!active) return;
        const parsed = raw ? JSON.parse(raw) : [];
        setFavoriteIds(Array.isArray(parsed) ? parsed : []);
      } catch {
        if (!active) return;
        setFavoriteIds([]);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(favoriteIds));
  }, [favoriteIds, ready, storageKey]);

  const value = useMemo(() => {
    const hasFavorite = (productId) => favoriteIds.includes(productId);

    const addFavorite = (productId) => {
      if (!productId) return;
      setFavoriteIds((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
    };

    const removeFavorite = (productId) => {
      setFavoriteIds((prev) => prev.filter((id) => id !== productId));
    };

    const toggleFavorite = (productId) => {
      if (!productId) return false;
      if (hasFavorite(productId)) {
        removeFavorite(productId);
        return false;
      }
      addFavorite(productId);
      return true;
    };

    return {
      favoriteIds,
      hasFavorite,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      clearFavorites: () => setFavoriteIds([]),
    };
  }, [favoriteIds]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return ctx;
}
