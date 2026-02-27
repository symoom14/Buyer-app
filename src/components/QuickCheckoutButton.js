import { Pressable, StyleSheet } from "react-native";
import AppIcon from "./AppIcon";
import { useAppTheme } from "../theme/useAppTheme";

export default function QuickCheckoutButton({
  onPress,
  disabled = false,
  buttonStyle,
  iconColor,
  iconSize = 16,
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        buttonStyle,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <AppIcon
        name="credit-card-fast-outline"
        variant="community"
        size={iconSize}
        color={disabled ? colors.textSubtle : iconColor || "#1E8E3E"}
      />
    </Pressable>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    button: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
