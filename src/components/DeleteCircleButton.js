import { Pressable, StyleSheet } from "react-native";
import { useAppTheme } from "../theme/useAppTheme";
import AppIcon from "./AppIcon";

export default function DeleteCircleButton({
  onPress,
  disabled = false,
  size = 32,
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors, size);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <AppIcon
        name="trash-can-outline"
        variant="community"
        size={Math.round(size * 0.5)}
        color={disabled ? colors.textSubtle : colors.danger}
      />
    </Pressable>
  );
}

const createStyles = (colors, size) =>
  StyleSheet.create({
    button: {
      width: size,
      height: size,
      borderRadius: size / 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.screen,
      borderWidth: 0,
      borderColor: colors.border,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
