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

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider } from "../src/context/AuthContext";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    "Poppins-Thin": require("../assets/fonts/Poppins-Thin.ttf"),
    "Poppins-ExtraLight": require("../assets/fonts/Poppins-ExtraLight.ttf"),
    "Poppins-Light": require("../assets/fonts/Poppins-Light.ttf"),
    "Poppins-Regular": require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
    "Poppins-ExtraBold": require("../assets/fonts/Poppins-ExtraBold.ttf"),
    "Poppins-Black": require("../assets/fonts/Poppins-Black.ttf"),
    "Poppins-ThinItalic": require("../assets/fonts/Poppins-ThinItalic.ttf"),
    "Poppins-ExtraLightItalic": require("../assets/fonts/Poppins-ExtraLightItalic.ttf"),
    "Poppins-LightItalic": require("../assets/fonts/Poppins-LightItalic.ttf"),
    "Poppins-Italic": require("../assets/fonts/Poppins-Italic.ttf"),
    "Poppins-MediumItalic": require("../assets/fonts/Poppins-MediumItalic.ttf"),
    "Poppins-SemiBoldItalic": require("../assets/fonts/Poppins-SemiBoldItalic.ttf"),
    "Poppins-BoldItalic": require("../assets/fonts/Poppins-BoldItalic.ttf"),
    "Poppins-ExtraBoldItalic": require("../assets/fonts/Poppins-ExtraBoldItalic.ttf"),
    "Poppins-BlackItalic": require("../assets/fonts/Poppins-BlackItalic.ttf"),
  });

  if (!fontsLoaded) return null;

  if (!Text.defaultProps) Text.defaultProps = {};
  Text.defaultProps.style = [
    { fontFamily: "Poppins-Regular" },
    Text.defaultProps.style,
  ];
  if (!TextInput.defaultProps) TextInput.defaultProps = {};
  TextInput.defaultProps.style = [
    { fontFamily: "Poppins-Regular" },
    TextInput.defaultProps.style,
  ];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CartProvider>
        <AuthProvider>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <Stack screenOptions={{ headerShown: false }} />
            <StatusBar style="auto" />
          </ThemeProvider>
        </AuthProvider>
      </CartProvider>
    </GestureHandlerRootView>
  );
}
