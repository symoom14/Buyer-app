import {
  getApp as getFirebaseApp,
  getApps as getFirebaseApps,
  initializeApp as initializeSecondaryApp,
} from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth as getSecondaryAuth,
  signOut as signOutSecondary,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "../../src/components/AppIcon";
import DeleteCircleButton from "../../src/components/DeleteCircleButton";
import ScreenContainer from "../../src/components/ScreenContainer";
import { useAuth } from "../../src/context/AuthContext";
import { db, firebaseConfig } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";

const normalizeRole = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const toDate = (value) => {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(0);
};

let secondaryAppInstance = null;

function getSecondaryAppAuth() {
  if (!secondaryAppInstance) {
    const existing = getFirebaseApps().find(
      (app) => app.name === "admin-user-ops",
    );
    secondaryAppInstance =
      existing || initializeSecondaryApp(firebaseConfig, "admin-user-ops");
  }
  return getSecondaryAuth(
    secondaryAppInstance || getFirebaseApp("admin-user-ops"),
  );
}

export default function AdminUsersScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedRole, setSelectedRole] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [newUserRole, setNewUserRole] = useState("customer");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingNameInput, setEditingNameInput] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snap) => {
      const allUsers = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((item) => normalizeRole(item.role) !== "admin")
        .sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));

      setUsers(allUsers);
    });

    return unsubscribe;
  }, []);

  const customerCount = useMemo(
    () =>
      users.filter((item) => normalizeRole(item.role) === "customer").length,
    [users],
  );
  const merchantCount = useMemo(
    () =>
      users.filter((item) => normalizeRole(item.role) === "merchant").length,
    [users],
  );

  const visibleUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const byRole =
      selectedRole === "all"
        ? users
        : users.filter((item) => normalizeRole(item.role) === selectedRole);

    if (!q) return byRole;

    return byRole.filter((item) => {
      const username = String(item.username || "").toLowerCase();
      const displayName = String(item.name || "").toLowerCase();
      return username.includes(q) || displayName.includes(q);
    });
  }, [searchQuery, selectedRole, users]);

  const resetAddForm = () => {
    setUsernameInput("");
    setPasswordInput("");
    setNewUserRole("customer");
  };

  const handleCreateUser = async () => {
    const username = usernameInput.trim().toLowerCase();
    const password = passwordInput;
    const role = normalizeRole(newUserRole);

    if (!username || !password) {
      Alert.alert("Missing fields", "Username and password are required.");
      return;
    }

    if (!["customer", "merchant"].includes(role)) {
      Alert.alert("Invalid role", "Role must be customer or merchant.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    try {
      setIsSaving(true);

      const secondaryAuth = getSecondaryAppAuth();
      const email = `${username}@buyer.app`;
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password,
      );

      const uid = credential.user.uid;

      await setDoc(doc(db, "users", uid), {
        username,
        name: username,
        role,
        createdAt: serverTimestamp(),
      });

      await signOutSecondary(secondaryAuth);
      setIsAddModalOpen(false);
      resetAddForm();
      Alert.alert("User added", `${username} account created successfully.`);
    } catch (error) {
      Alert.alert(
        "Failed",
        error?.message || "Could not create user right now.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteUser = (targetUser) => {
    Alert.alert(
      "Deactivate user",
      `${targetUser.username || targetUser.name || "This user"} will be removed from users collection and lose app access. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "users", targetUser.id));
              Alert.alert(
                "User deactivated",
                "User profile removed from the app.",
              );
            } catch (error) {
              Alert.alert(
                "Failed",
                error?.message || "Could not deactivate user.",
              );
            }
          },
        },
      ],
    );
  };

  const openEditNameModal = (targetUser) => {
    setEditingUser(targetUser);
    setEditingNameInput((targetUser.name || targetUser.username || "").trim());
    setIsEditModalOpen(true);
  };

  const handleUpdateDisplayName = async () => {
    const nextName = editingNameInput.trim();
    if (!editingUser?.id || !nextName) {
      Alert.alert("Missing name", "Please enter a valid display name.");
      return;
    }

    try {
      setIsUpdatingName(true);
      await updateDoc(doc(db, "users", editingUser.id), { name: nextName });
      setIsEditModalOpen(false);
      setEditingUser(null);
      setEditingNameInput("");
      Alert.alert("Updated", "Display name updated successfully.");
    } catch (error) {
      Alert.alert("Failed", error?.message || "Could not update display name.");
    } finally {
      setIsUpdatingName(false);
    }
  };

  return (
    <ScreenContainer bottomPadding={20}>
      <View style={styles.topBar}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by username or display name"
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        <View style={styles.filters}>
          <RolePill
            label={`All (${users.length})`}
            onPress={() => setSelectedRole("all")}
            style={[
              styles.pillBase,
              styles.allPill,
              selectedRole === "all" && styles.allPillSelected,
            ]}
            textStyle={[
              styles.pillTextBase,
              styles.allPillText,
              selectedRole === "all" && styles.allPillTextSelected,
            ]}
          />
          <RolePill
            label={`Customer (${customerCount})`}
            onPress={() => setSelectedRole("customer")}
            style={[
              styles.pillBase,
              styles.customerPill,
              selectedRole === "customer" && styles.customerPillSelected,
            ]}
            textStyle={[
              styles.pillTextBase,
              styles.customerPillText,
              selectedRole === "customer" && styles.customerPillTextSelected,
            ]}
          />
          <RolePill
            label={`Merchant (${merchantCount})`}
            onPress={() => setSelectedRole("merchant")}
            style={[
              styles.pillBase,
              styles.merchantPill,
              selectedRole === "merchant" && styles.merchantPillSelected,
            ]}
            textStyle={[
              styles.pillTextBase,
              styles.merchantPillText,
              selectedRole === "merchant" && styles.merchantPillTextSelected,
            ]}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {visibleUsers.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No users found for this role.</Text>
          </View>
        ) : null}

        {visibleUsers.map((item) => {
          const role = normalizeRole(item.role);
          const isMerchant = role === "merchant";
          const isCurrentAdmin = user?.uid === item.id;

          return (
            <View key={item.id} style={styles.card}>
              <View
                style={[
                  styles.avatarWrap,
                  isMerchant
                    ? styles.avatarWrapMerchant
                    : styles.avatarWrapCustomer,
                ]}
              >
                <AppIcon
                  name={role === "merchant" ? "account-tie" : "account"}
                  variant="community"
                  size={18}
                  color={isMerchant ? "#0A4AA3" : "#9A5A00"}
                />
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.userName}>
                  {item.name || item.username || "Unnamed user"}
                </Text>
                <Text style={styles.userMeta}>
                  @{item.username || "unknown"}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditNameModal(item)}
                activeOpacity={0.85}
              >
                <AppIcon
                  name="pencil-outline"
                  variant="community"
                  size={16}
                  color={colors.text}
                />
              </TouchableOpacity>

              <DeleteCircleButton
                onPress={() => confirmDeleteUser(item)}
                disabled={isCurrentAdmin}
                size={34}
              />
            </View>
          );
        })}
      </ScrollView>

      <SafeAreaView
        style={styles.fabSafeArea}
        edges={["bottom", "right"]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.addFab}
          onPress={() => setIsAddModalOpen(true)}
          activeOpacity={0.9}
        >
          <AppIcon
            name="account-plus"
            variant="community"
            size={24}
            color="#1E8E3E"
          />
        </TouchableOpacity>
      </SafeAreaView>

      <Modal
        visible={isAddModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsAddModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Add New User</Text>

                <TextInput
                  value={usernameInput}
                  onChangeText={setUsernameInput}
                  autoCapitalize="none"
                  placeholder="Username"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                />

                <TextInput
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  secureTextEntry
                  placeholder="Password"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                />

                <View style={styles.rolePickRow}>
                  <RolePill
                    label="Customer"
                    onPress={() => setNewUserRole("customer")}
                    style={[
                      styles.pillBase,
                      styles.customerPill,
                      newUserRole === "customer" && styles.customerPillSelected,
                    ]}
                    textStyle={[
                      styles.pillTextBase,
                      styles.customerPillText,
                      newUserRole === "customer" &&
                        styles.customerPillTextSelected,
                    ]}
                  />
                  <RolePill
                    label="Merchant"
                    onPress={() => setNewUserRole("merchant")}
                    style={[
                      styles.pillBase,
                      styles.merchantPill,
                      newUserRole === "merchant" && styles.merchantPillSelected,
                    ]}
                    textStyle={[
                      styles.pillTextBase,
                      styles.merchantPillText,
                      newUserRole === "merchant" &&
                        styles.merchantPillTextSelected,
                    ]}
                  />
                </View>

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => setIsAddModalOpen(false)}
                    disabled={isSaving}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.confirmButton}
                    onPress={handleCreateUser}
                    disabled={isSaving}
                  >
                    <Text style={styles.confirmButtonText}>
                      {isSaving ? "Creating..." : "Create"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsEditModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Edit Display Name</Text>

                <Text style={styles.modalHelper}>
                  @{editingUser?.username || "unknown"}
                </Text>

                <TextInput
                  value={editingNameInput}
                  onChangeText={setEditingNameInput}
                  autoCapitalize="words"
                  placeholder="Display name"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                  maxLength={50}
                />

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => setIsEditModalOpen(false)}
                    disabled={isUpdatingName}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.confirmButton}
                    onPress={handleUpdateDisplayName}
                    disabled={isUpdatingName}
                  >
                    <Text style={styles.confirmButtonText}>
                      {isUpdatingName ? "Saving..." : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScreenContainer>
  );
}

function RolePill({ label, onPress, style, textStyle }) {
  return (
    <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.85}>
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    topBar: {
      marginBottom: 12,
      gap: 10,
    },
    filters: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    searchInput: {
      backgroundColor: colors.input,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    fabSafeArea: {
      position: "absolute",
      right: 0,
      bottom: 0,
      pointerEvents: "box-none",
    },
    addFab: {
      marginRight: 16,
      marginBottom: 24,
      width: 56,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#E8F7EC",
      borderRadius: 28,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 6,
    },
    pillBase: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 14,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    pillTextBase: {
      fontSize: 13,
      fontWeight: "700",
    },
    allPill: {
      backgroundColor: colors.pillNeutral,
      borderColor: colors.pillNeutralBorder,
    },
    allPillSelected: {
      backgroundColor: colors.pillNeutralSelected,
      borderColor: colors.pillNeutralSelectedBorder,
    },
    allPillText: {
      color: colors.pillNeutralText,
    },
    allPillTextSelected: {
      color: colors.pillNeutralTextSelected,
    },
    customerPill: {
      backgroundColor: "#FFF3CC",
      borderColor: "#F8CE5E",
    },
    customerPillSelected: {
      backgroundColor: "#FFE390",
      borderColor: "#E4B12A",
    },
    customerPillText: {
      color: "#9A5A00",
    },
    customerPillTextSelected: {
      color: "#7B4600",
    },
    merchantPill: {
      backgroundColor: "#DCEBFF",
      borderColor: "#87B3FF",
    },
    merchantPillSelected: {
      backgroundColor: "#BCD7FF",
      borderColor: "#4D8FFF",
    },
    merchantPillText: {
      color: "#0A4AA3",
    },
    merchantPillTextSelected: {
      color: "#09387A",
    },
    listContent: {
      gap: 10,
      paddingBottom: 96,
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatarWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarWrapCustomer: {
      backgroundColor: "#FFF3CC",
    },
    avatarWrapMerchant: {
      backgroundColor: "#DCEBFF",
    },
    cardBody: {
      flex: 1,
    },
    userName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    userMeta: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSubtle,
    },
    editButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 0,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.screen,
    },
    emptyWrap: {
      marginTop: 20,
      alignItems: "center",
    },
    emptyText: {
      color: colors.textSubtle,
      fontSize: 13,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    modalCard: {
      width: "100%",
      maxWidth: 420,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 12,
    },
    modalHelper: {
      fontSize: 13,
      color: colors.textSubtle,
      marginBottom: 10,
    },
    input: {
      backgroundColor: colors.input,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      marginBottom: 10,
    },
    rolePickRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 14,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
    },
    cancelButton: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    cancelButtonText: {
      color: colors.text,
      fontWeight: "600",
    },
    confirmButton: {
      backgroundColor: colors.danger,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    confirmButtonText: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
  });
