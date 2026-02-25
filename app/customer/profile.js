import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppIcon from "../../src/components/AppIcon";
import { useThemePreference } from "../../src/context/ThemePreferenceContext";
import { auth, db } from "../../src/firebase/firebaseConfig";
import {
  DEFAULT_PAYMENT_METHOD_ID,
  PAYMENT_METHOD_PRESETS,
  normalizePaymentMethod,
} from "../../src/constants/paymentMethods";
import { useAppTheme } from "../../src/theme/useAppTheme";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { setScheme } = useThemePreference();
  const [displayName, setDisplayName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [username, setUsername] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPaymentMethods, setSavingPaymentMethods] = useState(false);
  const [isNameModalVisible, setIsNameModalVisible] = useState(false);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [defaultPaymentMethodId, setDefaultPaymentMethodId] = useState(
    DEFAULT_PAYMENT_METHOD_ID,
  );
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) {
          setPaymentMethods(PAYMENT_METHOD_PRESETS);
          setDefaultPaymentMethodId(DEFAULT_PAYMENT_METHOD_ID);
          return;
        }
        const data = snap.data();
        setDisplayName(data.name || "");
        setUsername(data.username || "");
        const methodsFromProfile = Array.isArray(data.paymentMethods)
          ? data.paymentMethods.map(normalizePaymentMethod).filter(Boolean)
          : [];
        const mergedMethods = PAYMENT_METHOD_PRESETS.map((preset) => {
          const existing = methodsFromProfile.find((method) => method.id === preset.id);
          return existing || preset;
        });
        setPaymentMethods(mergedMethods);
        const defaultIdFromProfile = String(
          data.defaultPaymentMethodId || DEFAULT_PAYMENT_METHOD_ID,
        );
        const defaultExists = mergedMethods.some(
          (method) => method.id === defaultIdFromProfile,
        );
        setDefaultPaymentMethodId(
          defaultExists ? defaultIdFromProfile : (mergedMethods[0]?.id || DEFAULT_PAYMENT_METHOD_ID),
        );
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
  const paymentMethodsById = useMemo(() => {
    const map = {};
    paymentMethods.forEach((method) => {
      map[method.id] = method;
    });
    return map;
  }, [paymentMethods]);
  const defaultPaymentMethodLabel =
    paymentMethodsById[defaultPaymentMethodId]?.label || "Not set";

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
  const savePaymentConfig = async (nextMethods, nextDefaultId) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return false;
    try {
      setSavingPaymentMethods(true);
      await setDoc(
        doc(db, "users", uid),
        {
          paymentMethods: nextMethods,
          defaultPaymentMethodId: nextDefaultId,
        },
        { merge: true },
      );
      setPaymentMethods(nextMethods);
      setDefaultPaymentMethodId(nextDefaultId);
      return true;
    } catch (error) {
      console.error("Failed to save payment methods:", error);
      Alert.alert("Failed", "Could not save payment method settings.");
      return false;
    } finally {
      setSavingPaymentMethods(false);
    }
  };
  const handleSetDefaultPaymentMethod = async (methodId) => {
    await savePaymentConfig(paymentMethods, methodId);
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + 110 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.avatarWrap}>
        <AppIcon name="account" variant="community" size={52} color={colors.textMuted} />
      </View>
      <Text style={styles.username}>{userName}</Text>

      <Pressable style={styles.actionCard} onPress={handleOpenNameModal}>
        <View style={styles.cardLeft}>
          <AppIcon
            name="badge-account"
            variant="community"
            size={22}
            color="#F57C00"
          />
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
            color={isDark ? "#7E57C2" : "#FBC02D"}
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
        onPress={() => setIsPaymentModalVisible(true)}
      >
        <View style={styles.cardLeft}>
          <AppIcon
            name="credit-card-outline"
            variant="community"
            size={22}
            color={isDark ? "#8BC34A" : "#2E7D32"}
          />
          <View>
            <Text style={styles.cardText}>Payment methods</Text>
            <Text style={styles.cardMeta}>
              Default: {loadingProfile ? "Loading..." : defaultPaymentMethodLabel}
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

      <Pressable
        style={styles.actionCard}
        onPress={() => router.push("/customer/saved-products")}
      >
        <View style={styles.cardLeft}>
          <AppIcon name="heart" variant="community" size={22} color="#D32F2F" />
          <View>
            <Text style={styles.cardText}>Saved products</Text>
            <Text style={styles.cardMeta}>Your favourite items</Text>
          </View>
        </View>
        <AppIcon
          name="chevron-right"
          variant="community"
          size={20}
          color={colors.textSubtle}
        />
      </Pressable>

      <Pressable
        style={styles.actionCard}
        onPress={() => router.push("/customer/saved-stores")}
      >
        <View style={styles.cardLeft}>
          <AppIcon
            name="store-check"
            variant="community"
            size={22}
            color="#1976D2"
          />
          <View>
            <Text style={styles.cardText}>Saved stores</Text>
            <Text style={styles.cardMeta}>Shops you follow</Text>
          </View>
        </View>
        <AppIcon
          name="chevron-right"
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

      <Modal
        visible={isPaymentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPaymentModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsPaymentModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCardLarge}>
                <Text style={styles.modalTitle}>Payment methods</Text>
                <ScrollView
                  style={styles.paymentScroll}
                  contentContainerStyle={styles.paymentScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.paymentSectionTitle}>Available methods</Text>
                  {paymentMethods.length === 0 ? (
                    <Text style={styles.paymentEmpty}>
                      No payment methods available.
                    </Text>
                  ) : (
                    <View style={styles.paymentMethodsCard}>
                      {paymentMethods.map((method, index) => {
                        const isDefault = method.id === defaultPaymentMethodId;
                        const hasDivider = index < paymentMethods.length - 1;
                        return (
                          <View
                            key={method.id}
                            style={[
                              styles.paymentMethodRow,
                              hasDivider && styles.paymentMethodDivider,
                            ]}
                          >
                            <View style={styles.paymentMethodLeft}>
                              <AppIcon
                                name={method.iconName || "credit-card-outline"}
                                variant="community"
                                size={20}
                                color={colors.text}
                              />
                              <View style={styles.paymentMethodTextWrap}>
                                <Text style={styles.paymentMethodLabel}>
                                  {method.label}
                                </Text>
                                <Text style={styles.paymentMethodMeta}>
                                  {isDefault ? "Default method" : "Available"}
                                </Text>
                              </View>
                            </View>
                            <Pressable
                              onPress={() => handleSetDefaultPaymentMethod(method.id)}
                              disabled={savingPaymentMethods || isDefault}
                              style={[
                                styles.defaultBtn,
                                isDefault && styles.defaultBtnActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.defaultBtnText,
                                  isDefault && styles.defaultBtnTextActive,
                                ]}
                              >
                                {isDefault ? "Default" : "Set default"}
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  )}

                </ScrollView>
                <View style={styles.modalButtons}>
                  <Pressable
                    style={styles.modalCancelButton}
                    onPress={() => setIsPaymentModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Close</Text>
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
    </ScrollView>
  );
}

const createStyles = (colors, isDark) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  container: {
    padding: 20,
    backgroundColor: colors.screen,
    flexGrow: 1,
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
  modalCardLarge: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    maxHeight: "78%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  paymentScroll: {
    maxHeight: 420,
  },
  paymentScrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  paymentSectionTitle: {
    marginTop: 2,
    marginBottom: 2,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  paymentEmpty: {
    fontSize: 13,
    color: colors.textSubtle,
    marginBottom: 6,
  },
  paymentMethodRow: {
    minHeight: 56,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "transparent",
  },
  paymentMethodsCard: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  paymentMethodDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  paymentMethodLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  paymentMethodTextWrap: {
    flex: 1,
  },
  paymentMethodLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  paymentMethodMeta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSubtle,
  },
  defaultBtn: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  defaultBtnActive: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  defaultBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  defaultBtnTextActive: {
    color: colors.success,
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
