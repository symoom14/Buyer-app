import { useMemo } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "./AppIcon";

export default function AddProductFab({ onPress, bottomOffset = 24, icon = "package-variant-plus" }) {
  const styles = useMemo(() => createStyles(bottomOffset), [bottomOffset]);

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["bottom", "right"]}
      pointerEvents="box-none"
    >
      <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.9}>
        <AppIcon name={icon} variant="community" size={24} color="#1E8E3E" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const createStyles = (bottomOffset) =>
  StyleSheet.create({
    safeArea: {
      position: "absolute",
      right: 0,
      bottom: 0,
      pointerEvents: "box-none",
    },
    button: {
      marginRight: 16,
      marginBottom: bottomOffset,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#E8F7EC",
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 6,
    },
  });
