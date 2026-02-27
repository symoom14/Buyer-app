import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import AppIcon from "../../src/components/AppIcon";
import { useThemePreference } from "../../src/context/ThemePreferenceContext";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

export default function AdminProfileScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { setScheme } = useThemePreference();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);

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
        console.error("Failed to load admin profile:", err);
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
        auth.currentUser?.email || "Admin",
      ),
    [displayName, username],
  );

  const handleToggleTheme = () => {
    setScheme(isDark ? "light" : "dark");
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
        <AppIcon
          name="shield-account"
          variant="community"
          size={50}
          color={colors.textMuted}
        />
      </View>
      <Text style={styles.username}>{userName}</Text>

      <View style={styles.actionCard}>
        <View style={styles.cardLeft}>
          <AppIcon name="account" variant="community" size={22} />
          <View>
            <Text style={styles.cardText}>Account</Text>
            <Text style={styles.cardMeta}>
              {loadingProfile ? "Loading..." : userName}
            </Text>
          </View>
        </View>
      </View>

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

      <Pressable
        style={styles.actionCard}
        onPress={() => router.push("/admin/logs")}
      >
        <View style={styles.cardLeft}>
          <AppIcon name="clipboard-text-clock-outline" variant="community" size={22} />
          <View>
            <Text style={styles.cardText}>Activity log</Text>
            <Text style={styles.cardMeta}>Track admin actions</Text>
          </View>
        </View>
        <AppIcon
          name="chevron-right"
          variant="community"
          size={20}
          color={colors.textSubtle}
        />
      </Pressable>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors) =>
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
      marginBottom: 10,
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
    cardText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    cardMeta: {
      marginTop: 2,
      fontSize: 13,
      color: colors.textSubtle,
    },
    logoutButton: {
      marginTop: "auto",
      width: 120,
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
    logoutText: {
      color: colors.background,
      fontWeight: "600",
      fontSize: 14,
    },
  });
