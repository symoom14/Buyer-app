import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, TextInput } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { CartProvider } from "../src/context/CartContext";
import { FavoritesProvider } from "../src/context/FavoritesContext";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider } from "../src/context/AuthContext";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    "GoogleSans-Regular": require("../assets/fonts/GoogleSans-Regular.ttf"),
    "GoogleSans-Medium": require("../assets/fonts/GoogleSans-Medium.ttf"),
    "GoogleSans-SemiBold": require("../assets/fonts/GoogleSans-SemiBold.ttf"),
    "GoogleSans-Bold": require("../assets/fonts/GoogleSans-Bold.ttf"),
    "GoogleSans-Italic": require("../assets/fonts/GoogleSans-Italic.ttf"),
    "GoogleSans-MediumItalic": require("../assets/fonts/GoogleSans-MediumItalic.ttf"),
    "GoogleSans-SemiBoldItalic": require("../assets/fonts/GoogleSans-SemiBoldItalic.ttf"),
    "GoogleSans-BoldItalic": require("../assets/fonts/GoogleSans-BoldItalic.ttf"),
  });

  if (!fontsLoaded) return null;

  if (!Text.defaultProps) Text.defaultProps = {};
  Text.defaultProps.style = [
    { fontFamily: "GoogleSans-Regular" },
    Text.defaultProps.style,
  ];
  if (!TextInput.defaultProps) TextInput.defaultProps = {};
  TextInput.defaultProps.style = [
    { fontFamily: "GoogleSans-Regular" },
    TextInput.defaultProps.style,
  ];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CartProvider>
        <FavoritesProvider>
          <AuthProvider>
            <ThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
            >
              <Stack screenOptions={{ headerShown: false }} />
              <StatusBar style="auto" />
            </ThemeProvider>
          </AuthProvider>
        </FavoritesProvider>
      </CartProvider>
    </GestureHandlerRootView>
  );
}
