import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { auth } from "../firebase/firebaseConfig";
import { useAppTheme } from "../theme/useAppTheme";

export default function LogoutButton() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

const createStyles = (colors) =>
  StyleSheet.create({
  button: {
    position: "absolute",
    left: 16,
    bottom: 24,
    width: 110,
    backgroundColor: colors.danger,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: "center",
    elevation: 5,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
  },
  text: {
    color: colors.background,
    fontWeight: "600",
    fontSize: 14,
  },
});
