import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppIcon from "./AppIcon";
import { useAppTheme } from "../theme/useAppTheme";

function isActive(pathname, key) {
  if (key === "home") {
    return pathname === "/admin/panel" || pathname === "/admin";
  }
  if (key === "users") {
    return pathname === "/admin/users";
  }
  if (key === "products") {
    return (
      pathname === "/admin/products" ||
      pathname.startsWith("/admin/store/") ||
      pathname.startsWith("/admin/store/edit-product/") ||
      pathname.startsWith("/admin/store/add-product/")
    );
  }
  if (key === "analytics") {
    return (
      pathname === "/admin/merchant-performance" ||
      pathname.startsWith("/admin/merchant/")
    );
  }
  if (key === "profile") {
    return pathname === "/admin/profile" || pathname === "/admin/logs";
  }
  return false;
}

export default function AdminQuickNavBar({ pathname }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const items = [
    {
      key: "home",
      label: "Home",
      icon: "home-outline",
      activeIcon: "home",
      onPress: () => router.push("/admin/panel"),
    },
    {
      key: "users",
      label: "Users",
      icon: "account-group-outline",
      activeIcon: "account-group",
      onPress: () => router.push("/admin/users"),
    },
    {
      key: "products",
      label: "Products",
      icon: "package-variant-closed",
      activeIcon: "package-variant",
      onPress: () => router.push("/admin/products"),
    },
    {
      key: "analytics",
      label: "Analytics",
      icon: "chart-box-outline",
      activeIcon: "chart-box",
      onPress: () => router.push("/admin/merchant-performance"),
    },
    {
      key: "profile",
      label: "Profile",
      icon: "account-outline",
      activeIcon: "account",
      onPress: () => router.push("/admin/profile"),
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
