import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import AppIcon from "./AppIcon";

export default function PdfViewer({ visible, uri, onClose }) {
  const insets = useSafeAreaInsets();

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
                color="#B71C1C"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 16,
  },
  viewerCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  header: {
    height: 58,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FDE4E4",
    alignItems: "center",
    justifyContent: "center",
  },
  webview: {
    flex: 1,
    backgroundColor: "#fff",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#666",
  },
});
