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
import { auth, db } from "../../src/firebase/firebaseConfig";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

export default function ProfileScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [username, setUsername] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [isNameModalVisible, setIsNameModalVisible] = useState(false);

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

  return (
    <View style={styles.container}>
      <View style={styles.avatarWrap}>
        <AppIcon name="account" variant="community" size={52} color="#3A3A3C" />
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
          color="#8A8A8E"
        />
      </Pressable>

      <View style={styles.card}>
        <AppIcon name="store" variant="community" size={22} />
        <Text style={styles.cardText}>Orders</Text>
      </View>

      <View style={styles.card}>
        <AppIcon name="cog-outline" variant="community" size={22} />
        <Text style={styles.cardText}>Settings</Text>
      </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F2F2F7",
  },
  username: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 14,
    marginBottom: 16,
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#E5E5EA",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
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
    color: "#666",
  },
  nameInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  saveNameButton: {
    height: 34,
    borderRadius: 17,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  saveNameText: {
    color: "#fff",
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
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
    backgroundColor: "#E5E5EA",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    color: "#333",
    fontWeight: "600",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 16,
    fontWeight: "500",
  },
  logoutButton: {
    marginTop: 40,
    backgroundColor: "#FF3B30",
    width: 130,
    alignSelf: "center",
    paddingVertical: 14,
    borderRadius: 999,
  },
  logoutText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
