

import { Platform } from "react-native";

const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

export const Colors = {
  light: {
    text: "#11181C",
    textMuted: "#555555",
    textSubtle: "#666666",
    background: "#fff",
    screen: "#F2F2F7",
    surface: "#FFFFFF",
    surfaceMuted: "#F2F2F2",
    input: "#E5E5EA",
    border: "#E5E5EA",
    borderSoft: "#EEEEEE",
    pill: "#EAF1FF",
    pillBorder: "#C9D9FF",
    pillSelected: "#D8E7FF",
    pillSelectedBorder: "#95B7FF",
    pillText: "#2357B8",
    pillTextSelected: "#18479E",
    pillNeutral: "#F2F2F7",
    pillNeutralBorder: "#DADAE0",
    pillNeutralSelected: "#DDDEE6",
    pillNeutralSelectedBorder: "#BCBEC9",
    pillNeutralText: "#4B4E5A",
    pillNeutralTextSelected: "#333642",
    success: "#1E8E3E",
    successSoft: "#E8F7EC",
    warning: "#EF6C00",
    danger: "#C62828",
    customerHeaderBg: "#FFAE00",
    customerHeaderText: "#000000",
    customerHomeHeaderText: "#ff8c00",
    merchantHeaderBg: "#0B6BE0",
    merchantHeaderText: "#FFFFFF",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#ECEDEE",
    textMuted: "#B5BBC2",
    textSubtle: "#9BA1A6",
    background: "#151718",
    screen: "#0F1113",
    surface: "#1B1E22",
    surfaceMuted: "#2A2E33",
    input: "#2A2E33",
    border: "#343A40",
    borderSoft: "#343A40",
    pill: "#233248",
    pillBorder: "#355072",
    pillSelected: "#2E4462",
    pillSelectedBorder: "#4C6B95",
    pillText: "#A9C8FF",
    pillTextSelected: "#C4DAFF",
    pillNeutral: "#2A2E33",
    pillNeutralBorder: "#3A4048",
    pillNeutralSelected: "#3B414A",
    pillNeutralSelectedBorder: "#4A515B",
    pillNeutralText: "#C3C8D0",
    pillNeutralTextSelected: "#E1E5EB",
    success: "#66BB6A",
    successSoft: "#223428",
    warning: "#FFB74D",
    danger: "#EF5350",
    customerHeaderBg: "#8A6100",
    customerHeaderText: "#F6F7F9",
    customerHomeHeaderText: "#ff8c00",
    merchantHeaderBg: "#084EA3",
    merchantHeaderText: "#F6F7F9",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    
    sans: "system-ui",
    
    serif: "ui-serif",
    
    rounded: "ui-rounded",
    
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
