import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMemo } from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import AppIcon from "./AppIcon";
import { useAppTheme } from "../theme/useAppTheme";

export default function PdfViewer({ visible, uri, onClose }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[
          styles.container,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 },
        ]}
        edges={["left", "right"]}
      >
        <View style={styles.viewerCard}>
          <View style={styles.header}>
            <Text style={styles.title}>Invoice Preview</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <AppIcon
                name="window-close"
                variant="community"
                size={18}
                color={colors.danger}
              />
            </TouchableOpacity>
          </View>

          {uri ? (
            <WebView
              source={{ uri }}
              style={styles.webview}
              originWhitelist={["*"]}
              allowFileAccess
              allowingReadAccessToURL={uri}
            />
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                Unable to load invoice preview.
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screen,
    paddingHorizontal: 16,
  },
  viewerCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    height: 58,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  webview: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.textSubtle,
  },
});
