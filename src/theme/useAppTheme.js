import { Colors } from "@/constants/theme";
import { useThemePreference } from "../context/ThemePreferenceContext";

export function useAppTheme() {
  const { scheme } = useThemePreference();

  return {
    scheme,
    isDark: scheme === "dark",
    colors: Colors[scheme],
  };
}
