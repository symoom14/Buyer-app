import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { auth } from "../firebase/firebaseConfig";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handleLogout}>
      <Text style={styles.text}>{"Log out"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    left: 16,
    bottom: 24,
    backgroundColor: "#e53935",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 5,
  },
  text: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
