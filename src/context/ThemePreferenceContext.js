import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "theme_preference";
const ThemePreferenceContext = createContext(null);

export function ThemePreferenceProvider({ children }) {
  const [scheme, setSchemeState] = useState("light");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let alive = true;

    const loadPreference = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!alive) return;
        if (saved === "dark" || saved === "light") {
          setSchemeState(saved);
        }
      } catch (_err) {

      } finally {
        if (alive) setIsReady(true);
      }
    };

    loadPreference();
    return () => {
      alive = false;
    };
  }, []);

  const setScheme = useCallback(async (next) => {
    const normalized = next === "dark" ? "dark" : "light";
    setSchemeState(normalized);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, normalized);
    } catch (_err) {

    }
  }, []);

  const toggleScheme = useCallback(() => {
    setSchemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      scheme,
      isDark: scheme === "dark",
      isReady,
      setScheme,
      toggleScheme,
    }),
    [scheme, isReady, setScheme, toggleScheme],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    throw new Error("useThemePreference must be used within ThemePreferenceProvider");
  }
  return ctx;
}
