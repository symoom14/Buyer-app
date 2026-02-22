import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import AppIcon from "../../src/components/AppIcon";
import { useThemePreference } from "../../src/context/ThemePreferenceContext";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { setScheme } = useThemePreference();
  const [displayName, setDisplayName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [username, setUsername] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [isNameModalVisible, setIsNameModalVisible] = useState(false);
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) return;
        const data = snap.data();
        setDisplayName(data.name || "");
        setUsername(data.username || "");
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, []);

  const userName = useMemo(
    () =>
      getUserDisplayName(
        { name: displayName, username },
        auth.currentUser?.email || "User",
      ),
    [displayName, username],
  );

  const handleSaveName = async () => {
    const uid = auth.currentUser?.uid;
    const nextName = draftName.trim();

    if (!uid || !nextName) {
      Alert.alert("Name required", "Please enter a display name.");
      return;
    }

    try {
      setSavingName(true);
      await updateDoc(doc(db, "users", uid), { name: nextName });
      setDisplayName(nextName);
      setDraftName(nextName);
      setIsNameModalVisible(false);
      Alert.alert("Saved", "Your display name has been updated.");
    } catch (_err) {
      Alert.alert("Failed", "Could not update display name right now.");
    } finally {
      setSavingName(false);
    }
  };

  const handleOpenNameModal = () => {
    setDraftName(displayName);
    setIsNameModalVisible(true);
  };

  const handleLogout = async () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await signOut(auth);
          router.replace("/");
        },
      },
    ]);
  };

  const handleToggleTheme = () => {
    setScheme(isDark ? "light" : "dark");
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarWrap}>
        <AppIcon name="account" variant="community" size={52} color={colors.textMuted} />
      </View>
      <Text style={styles.username}>{userName}</Text>

      <Pressable style={styles.actionCard} onPress={handleOpenNameModal}>
        <View style={styles.cardLeft}>
          <AppIcon name="badge-account" variant="community" size={22} />
          <View>
            <Text style={styles.cardText}>Change display name</Text>
            <Text style={styles.cardMeta}>
              {loadingProfile ? "Loading..." : userName}
            </Text>
          </View>
        </View>
        <AppIcon
          name="chevron-right"
          variant="community"
          size={20}
          color={colors.textSubtle}
        />
      </Pressable>

      <Pressable style={styles.actionCard} onPress={handleToggleTheme}>
        <View style={styles.cardLeft}>
          <AppIcon
            name={isDark ? "weather-night" : "white-balance-sunny"}
            variant="community"
            size={22}
          />
          <View>
            <Text style={styles.cardText}>Theme</Text>
            <Text style={styles.cardMeta}>
              {isDark ? "Dark mode" : "Light mode"}
            </Text>
          </View>
        </View>
        <AppIcon
          name="autorenew"
          variant="community"
          size={20}
          color={colors.textSubtle}
        />
      </Pressable>

      <Modal
        visible={isNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNameModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsNameModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Change display name</Text>
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.nameInput}
                  maxLength={50}
                  autoFocus
                />
                <View style={styles.modalButtons}>
                  <Pressable
                    style={styles.modalCancelButton}
                    onPress={() => setIsNameModalVisible(false)}
                    disabled={savingName}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.saveNameButton}
                    onPress={handleSaveName}
                    disabled={savingName}
                  >
                    <Text style={styles.saveNameText}>
                      {savingName ? "Saving..." : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors, isDark) =>
  StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.screen,
  },
  username: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 14,
    marginBottom: 16,
    color: colors.text,
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.input,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardMeta: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSubtle,
  },
  nameInput: {
    backgroundColor: colors.input,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  saveNameButton: {
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  saveNameText: {
    color: colors.background,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancelButton: {
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 14,
    backgroundColor: colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  logoutButton: {
    marginTop: 40,
    backgroundColor: colors.danger,
    width: 130,
    alignSelf: "center",
    paddingVertical: 14,
    borderRadius: 999,
  },
  logoutText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
