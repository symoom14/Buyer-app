import { StyleSheet, Text, View } from "react-native";
import AppIcon from "./AppIcon";

export default function EmptyFieldState({ message }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconLayer}>
        <AppIcon
          name="soccer-field"
          variant="community"
          size={150}
          color="#C7C7CC"
        />
      </View>
      <View style={styles.messageLayer}>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: "#8E8E93",
    fontSize: 18,
    fontWeight: "400",
    lineHeight: 24,
  },
});
