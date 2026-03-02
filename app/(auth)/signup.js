import LottieView from "lottie-react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
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
import {
  buildBuyerEmailFromUsername,
  sanitizeUsernameInput,
  validatePasswordInput,
  validateUsernameInput,
} from "../../src/utils/authInput";

const PASSWORD_REQUIREMENTS = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
  },
  {
    key: "uppercase",
    label: "At least one uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    key: "lowercase",
    label: "At least one lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    key: "number",
    label: "At least one number",
    test: (password) => /\d/.test(password),
  },
  {
    key: "symbol",
    label: "At least one symbol",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

const getPasswordRuleResults = (password) =>
  PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }));

const isPasswordValid = (password) =>
  PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password));

export default function SignUp() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [role, setRole] = useState("customer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingRoute, setPendingRoute] = useState(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const usernameRef = useRef("");
  const passwordRef = useRef("");
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const passwordRuleResults = useMemo(
    () => getPasswordRuleResults(passwordInput),
    [passwordInput],
  );

  const buttonBg = useMemo(
    () =>
    buttonAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.text, colors.merchantHeaderBg],
    }),
    [buttonAnim, colors],
  );

  const handleSignUp = async () => {
    setError("");

    const usernameValidation = validateUsernameInput(usernameRef.current);
    if (!usernameValidation.ok) {
      setError(usernameValidation.error);
      return;
    }

    const passwordValidation = validatePasswordInput(passwordRef.current);
    if (!passwordValidation.ok) {
      setError(passwordValidation.error);
      return;
    }

    if (!isPasswordValid(passwordValidation.value)) {
      setError(
        "Password must include 8+ characters, uppercase, lowercase, number, and symbol.",
      );
      return;
    }

    const normalizedRole = role === "merchant" ? "merchant" : "customer";

    try {
      setLoading(true);
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 160,
        useNativeDriver: false,
      }).start();

      const email = buildBuyerEmailFromUsername(usernameValidation.value);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        passwordValidation.value,
      );

      const uid = userCredential.user.uid;
      const normalizedUsername = sanitizeUsernameInput(usernameValidation.value);

      await setDoc(doc(db, "users", uid), {
        username: normalizedUsername,
        name: normalizedUsername,
        role: normalizedRole,
        createdAt: serverTimestamp(),
      });

      if (normalizedRole === "merchant") {
        setPendingRoute("/merchant/dashboard");
      } else {
        setPendingRoute("/customer/home");
      }
    } catch (err) {
      Animated.timing(buttonAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
      setLoading(false);
      const errorCode = String(err?.code || "");
      if (errorCode === "auth/email-already-in-use") {
        setError("Username is already taken");
      } else if (errorCode === "auth/weak-password") {
        setError("Choose a stronger password");
      } else {
        setError("Unable to create account. Please try again.");
      }
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
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>
                Join Buyer to start shopping or selling
              </Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              onChangeText={(text) => {
                usernameRef.current = text;
              }}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textSubtle}
              secureTextEntry
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
              maxLength={128}
              onChangeText={(text) => {
                passwordRef.current = text;
                setPasswordInput(text);
              }}
            />
            {isPasswordFocused ? (
              <View style={styles.passwordRequirements}>
                {passwordRuleResults.map((rule) => (
                  <View key={rule.key} style={styles.passwordRequirementRow}>
                    <AppIcon
                      name={rule.met ? "check-circle" : "close-circle-outline"}
                      variant="community"
                      size={15}
                      color={rule.met ? colors.success : colors.danger}
                    />
                    <Text
                      style={[
                        styles.passwordRequirementItem,
                        rule.met && styles.passwordRequirementMet,
                      ]}
                    >
                      {rule.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.roleLabel}>I&apos;m signing up as a:</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === "customer" && styles.activeRole,
                  role === "customer" && styles.activeRoleCustomer,
                ]}
                onPress={() => setRole("customer")}
              >
                <Text
                  style={[
                    styles.roleText,
                    role === "customer" && styles.roleTextCustomerActive,
                  ]}
                >
                  Customer
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === "merchant" && styles.activeRole,
                ]}
                onPress={() => setRole("merchant")}
              >
                <Text
                  style={[
                    styles.roleText,
                    role === "merchant" && styles.roleTextMerchantActive,
                  ]}
                >
                  Merchant
                </Text>
              </TouchableOpacity>
            </View>

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
              <Pressable onPress={handleSignUp}>
                <Animated.View
                  style={[styles.button, { backgroundColor: buttonBg }]}
                >
                  <AppIcon
                    name="account-plus"
                    variant="community"
                    size={20}
                    color={colors.background}
                  />
                  <Text style={styles.buttonText}>Create Account</Text>
                </Animated.View>
              </Pressable>
            )}

            <TouchableOpacity onPress={() => router.push("/login")}>
              <Text style={styles.link}>Already have an account? Log in</Text>
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
    color: colors.merchantHeaderBg,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
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
  passwordRequirements: {
    marginTop: -6,
    marginBottom: 10,
    paddingHorizontal: 2,
    gap: 2,
  },
  passwordRequirementItem: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  passwordRequirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  passwordRequirementMet: {
    color: colors.success,
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
    marginVertical: 12,
  },
  roleLabel: {
    fontSize: 15,
    color: colors.textSubtle,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 1,
  },
  roleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
  },
  activeRole: {
    backgroundColor: colors.pill,
  },
  activeRoleCustomer: {
    backgroundColor: "#FFF6CC",
  },
  roleText: {
    fontWeight: "600",
    color: colors.textMuted,
  },
  roleTextCustomerActive: {
    color: "#db7800",
  },
  roleTextMerchantActive: {
    color: colors.merchantHeaderBg,
  },
  button: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
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
    marginTop: 8,
    textAlign: "left",
  },
  link: {
    marginTop: 20,
    textAlign: "center",
    color: colors.textMuted,
  },
});
