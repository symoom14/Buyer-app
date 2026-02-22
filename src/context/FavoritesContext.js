import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "../firebase/firebaseConfig";

const FavoritesContext = createContext(null);

function getFavoritesKey(uid) {
  return `favorites:${uid || "guest"}`;
}

function getStoreFavoritesKey(uid) {
  return `store-favorites:${uid || "guest"}`;
}

export function FavoritesProvider({ children }) {
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [favoriteStoreIds, setFavoriteStoreIds] = useState([]);
  const [storageKey, setStorageKey] = useState(getFavoritesKey(null));
  const [storeStorageKey, setStoreStorageKey] = useState(getStoreFavoritesKey(null));
  const [ready, setReady] = useState(false);
  const [storesReady, setStoresReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setReady(false);
      setStoresReady(false);
      setStorageKey(getFavoritesKey(user?.uid || null));
      setStoreStorageKey(getStoreFavoritesKey(user?.uid || null));
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
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storeStorageKey);
        if (!active) return;
        const parsed = raw ? JSON.parse(raw) : [];
        setFavoriteStoreIds(Array.isArray(parsed) ? parsed : []);
      } catch {
        if (!active) return;
        setFavoriteStoreIds([]);
      } finally {
        if (active) setStoresReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [storeStorageKey]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(favoriteIds));
  }, [favoriteIds, ready, storageKey]);

  useEffect(() => {
    if (!storesReady) return;
    AsyncStorage.setItem(storeStorageKey, JSON.stringify(favoriteStoreIds));
  }, [favoriteStoreIds, storesReady, storeStorageKey]);

  const value = useMemo(() => {
    const hasFavorite = (productId) => favoriteIds.includes(productId);
    const hasFavoriteStore = (storeId) => favoriteStoreIds.includes(storeId);

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

    const addFavoriteStore = (storeId) => {
      if (!storeId) return;
      setFavoriteStoreIds((prev) => (prev.includes(storeId) ? prev : [...prev, storeId]));
    };

    const removeFavoriteStore = (storeId) => {
      setFavoriteStoreIds((prev) => prev.filter((id) => id !== storeId));
    };

    const toggleFavoriteStore = (storeId) => {
      if (!storeId) return false;
      if (hasFavoriteStore(storeId)) {
        removeFavoriteStore(storeId);
        return false;
      }
      addFavoriteStore(storeId);
      return true;
    };

    return {
      favoriteIds,
      favoriteStoreIds,
      hasFavorite,
      hasFavoriteStore,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      addFavoriteStore,
      removeFavoriteStore,
      toggleFavoriteStore,
      clearFavorites: () => setFavoriteIds([]),
      clearFavoriteStores: () => setFavoriteStoreIds([]),
    };
  }, [favoriteIds, favoriteStoreIds]);

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
