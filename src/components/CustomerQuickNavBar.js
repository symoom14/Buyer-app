import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppIcon from "./AppIcon";
import { useAppTheme } from "../theme/useAppTheme";

function isActive(pathname, key) {
  if (key === "home") {
    return (
      pathname === "/customer/home" || pathname === "/customer"
    );
  }
  if (key === "orders") {
    return (
      pathname === "/customer/orders" ||
      pathname.startsWith("/customer/orders/") ||
      pathname.startsWith("/customer/order/")
    );
  }
  if (key === "favourites") {
    return (
      pathname === "/customer/saved-products" ||
      pathname === "/customer/saved-stores"
    );
  }
  if (key === "profile") {
    return pathname === "/customer/profile";
  }
  return false;
}

export default function CustomerQuickNavBar({ pathname }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const items = [
    {
      key: "home",
      label: "Home",
      icon: "home-outline",
      activeIcon: "home",
      onPress: () => router.push("/customer/home"),
    },
    {
      key: "orders",
      label: "Orders",
      icon: "receipt-text-outline",
      activeIcon: "receipt-text",
      onPress: () => router.push("/customer/orders"),
    },
    {
      key: "favourites",
      label: "Favourites",
      icon: "heart-outline",
      activeIcon: "heart",
      onPress: () => router.push("/customer/saved-products"),
    },
    {
      key: "profile",
      label: "Profile",
      icon: "account-outline",
      activeIcon: "account",
      onPress: () => router.push("/customer/profile"),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <View style={styles.bar}>
        {items.map((item) => {
          const active = isActive(pathname, item.key);
          return (
            <Pressable
              key={item.key}
              style={[styles.item, active && styles.itemActive]}
              onPress={item.onPress}
            >
              <AppIcon
                name={active ? item.activeIcon || item.icon : item.icon}
                variant="community"
                size={18}
                color={active ? colors.text : colors.textSubtle}
              />
              <Text style={[styles.label, active && styles.labelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    safeArea: {
      backgroundColor: colors.background,
      paddingTop: 6,
    },
    bar: {
      marginHorizontal: 12,
      marginBottom: 8,
      borderRadius: 28,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 8,
      paddingHorizontal: 6,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    item: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
      borderRadius: 999,
      gap: 3,
    },
    itemActive: {
      backgroundColor: colors.surfaceMuted,
    },
    label: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSubtle,
    },
    labelActive: {
      color: colors.text,
    },
  });
