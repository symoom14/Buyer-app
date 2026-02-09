import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { auth } from "../../src/firebase/firebaseConfig";

export default function ProfileScreen() {
  const router = useRouter();

  const userName =
    auth.currentUser?.displayName || auth.currentUser?.email || "User";

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
      <Text style={styles.username}>{userName}</Text>

      <View style={styles.card}>
        <Ionicons name="receipt-outline" size={22} />
        <Text style={styles.cardText}>Orders</Text>
      </View>

      <View style={styles.card}>
        <Ionicons name="settings-outline" size={22} />
        <Text style={styles.cardText}>Settings</Text>
      </View>

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
    marginVertical: 30,
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
