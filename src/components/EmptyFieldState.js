import { StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import AppIcon from "./AppIcon";
import { useAppTheme } from "../theme/useAppTheme";

export default function EmptyFieldState({ message }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.iconLayer}>
        <AppIcon
          name="soccer-field"
          variant="community"
          size={150}
          color={colors.border}
        />
      </View>
      <View style={styles.messageLayer}>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -90 }],
  },
  messageLayer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 50,
  },
  message: {
    textAlign: "center",
    color: colors.textSubtle,
    fontSize: 18,
    fontWeight: "400",
    lineHeight: 24,
  },
});
