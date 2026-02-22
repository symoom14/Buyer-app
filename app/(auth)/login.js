import LottieView from "lottie-react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "../../src/components/AppIcon";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";

export default function Login() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingRoute, setPendingRoute] = useState(null);
  const usernameRef = useRef("");
  const passwordRef = useRef("");
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const buttonBg = useMemo(
    () =>
    buttonAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.text, colors.success],
    }),
    [buttonAnim, colors],
  );

  const handleLogin = async () => {
    setError("");

    if (!usernameRef.current || !passwordRef.current) {
      setError("All fields are required");
      return;
    }

    try {
      setLoading(true);
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 160,
        useNativeDriver: false,
      }).start();

      const email = `${usernameRef.current}@buyer.app`;

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        passwordRef.current,
      );

      const uid = userCredential.user.uid;

      const userDoc = await getDoc(doc(db, "users", uid));

      if (!userDoc.exists()) {
        throw new Error("User profile not found");
      }

      const { role } = userDoc.data();

      if (role === "merchant") {
        setPendingRoute("/merchant/dashboard");
      } else if (role === "customer") {
        setPendingRoute("/customer/home");
      } else if (role === "admin") {
        setPendingRoute("/admin");
      } else {
        throw new Error("Invalid user role");
      }
    } catch (_err) {
      Animated.timing(buttonAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
      setLoading(false);
      setError("Invalid username or password");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.brand}>Buyer</Text>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>
                Sign in to continue to your account
              </Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
              onChangeText={(text) => {
                usernameRef.current = text;
              }}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textSubtle}
              secureTextEntry
              onChangeText={(text) => {
                passwordRef.current = text;
              }}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {loading ? (
              <View style={styles.lottieWrap}>
                <LottieView
                  source={require("../../assets/lottie/loading tick.json")}
                  autoPlay
                  loop={false}
                  style={styles.lottie}
                  onAnimationFinish={() => {
                    if (pendingRoute) {
                      router.replace(pendingRoute);
                      setPendingRoute(null);
                    } else {
                      setLoading(false);
                    }
                  }}
                />
              </View>
            ) : (
              <Pressable onPress={handleLogin}>
                <Animated.View
                  style={[styles.button, { backgroundColor: buttonBg }]}
                >
                  <AppIcon
                    name="arrow-right-circle"
                    variant="community"
                    size={20}
                    color={colors.background}
                  />
                  <Text style={styles.buttonText}>Log In</Text>
                </Animated.View>
              </Pressable>
            )}

            <TouchableOpacity onPress={() => router.push("/signup")}>
              <Text style={styles.link}>
                Don&apos;t have an account? Sign up
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignSelf: "center",
    width: "88%",
    maxWidth: 360,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  header: {
    marginBottom: 24,
  },
  brand: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.customerHeaderBg,
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 10,
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSubtle,
    lineHeight: 18,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    color: colors.text,
  },
  button: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  lottieWrap: {
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    height: 52,
  },
  lottie: {
    width: 160,
    height: 72,
  },
  buttonText: {
    color: colors.background,
    fontWeight: "700",
  },
  error: {
    color: colors.danger,
    marginTop: 12,
    textAlign: "left",
  },
  link: {
    marginTop: 20,
    textAlign: "center",
    color: colors.textMuted,
  },
});
