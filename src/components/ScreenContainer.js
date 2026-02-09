import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ScreenContainer({
  children,
  disableBottomInset = false,
  bottomPadding = 16,
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: 16,
          paddingBottom: (disableBottomInset ? 0 : insets.bottom) + bottomPadding,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
});
