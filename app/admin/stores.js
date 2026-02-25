import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
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
import { db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";

const toDate = (value) => {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return null;
};
const normalizeRole = (value) => String(value || "").trim().toLowerCase();

export default function AdminStoresScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [stores, setStores] = useState([]);
  const [merchantNameById, setMerchantNameById] = useState({});
  const [merchants, setMerchants] = useState([]);
  const [assignTargetStore, setAssignTargetStore] = useState(null);
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [renameTargetStore, setRenameTargetStore] = useState(null);
  const [renameInput, setRenameInput] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [productCountByStore, setProductCountByStore] = useState({});
  const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreMerchantId, setNewStoreMerchantId] = useState("");
  const [savingNewStore, setSavingNewStore] = useState(false);

  useEffect(() => {
    const unsubStores = onSnapshot(collection(db, "stores"), (snap) => {
      const rows = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .sort((a, b) => {
          const aDate = toDate(a.createdAt)?.getTime?.() || 0;
          const bDate = toDate(b.createdAt)?.getTime?.() || 0;
          return bDate - aDate;
        });

      setStores(rows);
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const byId = {};
      const merchantRows = [];
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const displayName = data?.name || data?.username || "Unknown merchant";
        byId[docSnap.id] = displayName;
        if (normalizeRole(data?.role) === "merchant") {
          merchantRows.push({
            id: docSnap.id,
            name: displayName,
          });
        }
      });
      merchantRows.sort((a, b) => a.name.localeCompare(b.name));
      setMerchantNameById(byId);
      setMerchants(merchantRows);
    });
    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      const countMap = {};
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const storeId = data?.storeId;
        if (!storeId) return;
        countMap[storeId] = (countMap[storeId] || 0) + 1;
      });
      setProductCountByStore(countMap);
    });

    return () => {
      unsubStores();
      unsubUsers();
      unsubProducts();
    };
  }, []);

  const openAssignModal = (store) => {
    setAssignTargetStore(store);
    setSelectedMerchantId(store.merchantId || "");
  };

  const handleAssignMerchant = async () => {
    if (!assignTargetStore?.id || !selectedMerchantId) {
      Alert.alert("Missing merchant", "Please select a merchant.");
      return;
    }

    try {
      setSavingAssignment(true);
      await updateDoc(doc(db, "stores", assignTargetStore.id), {
        merchantId: selectedMerchantId,
      });
      setAssignTargetStore(null);
      setSelectedMerchantId("");
      Alert.alert("Updated", "Store has been assigned to the selected merchant.");
    } catch (error) {
      Alert.alert("Failed", error?.message || "Could not assign merchant.");
    } finally {
      setSavingAssignment(false);
    }
  };

  const openRenameModal = (store) => {
    setRenameTargetStore(store);
    setRenameInput((store.name || "").trim());
  };

  const handleRenameStore = async () => {
    const nextName = renameInput.trim();

    if (!renameTargetStore?.id || !nextName) {
      Alert.alert("Invalid name", "Please enter a valid store name.");
      return;
    }

    try {
      setSavingRename(true);
      await updateDoc(doc(db, "stores", renameTargetStore.id), {
        name: nextName,
      });
      setRenameTargetStore(null);
      setRenameInput("");
      Alert.alert("Updated", "Store name updated successfully.");
    } catch (error) {
      Alert.alert("Failed", error?.message || "Could not rename store.");
    } finally {
      setSavingRename(false);
    }
  };

  const openAddStoreModal = () => {
    setIsAddStoreModalOpen(true);
    setNewStoreName("");
    setNewStoreMerchantId("");
  };

  const handleAddStore = async () => {
    const name = newStoreName.trim();
    if (!name) {
      Alert.alert("Missing store name", "Please enter a store name.");
      return;
    }
    if (!newStoreMerchantId) {
      Alert.alert("Missing merchant", "Please select a merchant.");
      return;
    }

    try {
      setSavingNewStore(true);
      await addDoc(collection(db, "stores"), {
        name,
        merchantId: newStoreMerchantId,
        category: "Other",
        createdAt: serverTimestamp(),
      });
      setIsAddStoreModalOpen(false);
      setNewStoreName("");
      setNewStoreMerchantId("");
      Alert.alert("Store added", "New store created successfully.");
    } catch (error) {
      Alert.alert("Failed", error?.message || "Could not add store.");
    } finally {
      setSavingNewStore(false);
    }
  };

  const confirmDeleteStore = (store) => {
    Alert.alert(
      "Delete store",
      `Delete ${store.name || "this store"}? This removes the store from the platform.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "stores", store.id));
              Alert.alert("Deleted", "Store deleted successfully.");
            } catch (error) {
              Alert.alert("Failed", error?.message || "Could not delete store.");
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer bottomPadding={20}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {stores.length === 0 ? (
          <Text style={styles.emptyText}>No stores found.</Text>
        ) : null}

        {stores.map((store) => {
          const openedDate = toDate(store.createdAt);
          return (
            <View key={store.id} style={styles.card}>
              <View style={styles.iconWrap}>
                <AppIcon name="store" variant="community" size={20} color={colors.text} />
              </View>

              <View style={styles.body}>
                <Text style={styles.storeName}>{store.name || "Unnamed Store"}</Text>
                <Text style={styles.meta}>
                  Merchant: {merchantNameById[store.merchantId] || "Unknown merchant"}
                </Text>
                <Text style={styles.meta}>
                  Products: {productCountByStore[store.id] || 0}
                </Text>
                <Text style={styles.meta}>
                  Opened: {openedDate ? openedDate.toLocaleDateString() : "—"}
                </Text>
              </View>

              <View style={styles.actionCol}>
                <TouchableOpacity
                  style={styles.assignButton}
                  onPress={() => openAssignModal(store)}
                  activeOpacity={0.85}
                >
                  <AppIcon
                    name="account-switch-outline"
                    variant="community"
                    size={16}
                    color={colors.text}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.assignButton}
                  onPress={() => openRenameModal(store)}
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
                  size={34}
                  onPress={() => confirmDeleteStore(store)}
                />
              </View>
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
          onPress={openAddStoreModal}
          activeOpacity={0.9}
        >
          <AppIcon name="store-plus" variant="community" size={24} color="#1E8E3E" />
        </TouchableOpacity>
      </SafeAreaView>

      <Modal
        visible={!!assignTargetStore}
        transparent
        animationType="fade"
        onRequestClose={() => setAssignTargetStore(null)}
      >
        <TouchableWithoutFeedback onPress={() => setAssignTargetStore(null)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Assign Store Merchant</Text>
                <Text style={styles.modalSubtitle}>
                  {assignTargetStore?.name || "Store"}
                </Text>

                <ScrollView
                  style={styles.merchantList}
                  contentContainerStyle={styles.merchantListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {merchants.length === 0 ? (
                    <Text style={styles.emptyMerchantsText}>No merchants available.</Text>
                  ) : null}

                  {merchants.map((merchant) => {
                    const selected = merchant.id === selectedMerchantId;
                    return (
                      <TouchableOpacity
                        key={merchant.id}
                        style={[
                          styles.merchantOption,
                          selected && styles.merchantOptionSelected,
                        ]}
                        onPress={() => setSelectedMerchantId(merchant.id)}
                        activeOpacity={0.85}
                      >
                        <AppIcon
                          name="account-tie"
                          variant="community"
                          size={16}
                          color={selected ? "#0A4AA3" : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.merchantOptionText,
                            selected && styles.merchantOptionTextSelected,
                          ]}
                        >
                          {merchant.name}
                        </Text>
                        {selected ? (
                          <AppIcon
                            name="check-circle"
                            variant="community"
                            size={16}
                            color={colors.success}
                          />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.modalCancelButton}
                    onPress={() => setAssignTargetStore(null)}
                    disabled={savingAssignment}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.modalSaveButton}
                    onPress={handleAssignMerchant}
                    disabled={savingAssignment}
                  >
                    <Text style={styles.modalSaveText}>
                      {savingAssignment ? "Saving..." : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={!!renameTargetStore}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTargetStore(null)}
      >
        <TouchableWithoutFeedback onPress={() => setRenameTargetStore(null)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Rename Store</Text>
                <Text style={styles.modalSubtitle}>
                  {renameTargetStore?.name || "Store"}
                </Text>

                <TextInput
                  value={renameInput}
                  onChangeText={setRenameInput}
                  autoCapitalize="words"
                  placeholder="Store name"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.nameInput}
                  maxLength={80}
                />

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.modalCancelButton}
                    onPress={() => setRenameTargetStore(null)}
                    disabled={savingRename}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.modalSaveButton}
                    onPress={handleRenameStore}
                    disabled={savingRename}
                  >
                    <Text style={styles.modalSaveText}>
                      {savingRename ? "Saving..." : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={isAddStoreModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddStoreModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsAddStoreModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Add Store</Text>

                <TextInput
                  value={newStoreName}
                  onChangeText={setNewStoreName}
                  autoCapitalize="words"
                  placeholder="Store name"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.nameInput}
                  maxLength={80}
                />

                <Text style={styles.merchantPickerLabel}>Assign merchant</Text>
                <ScrollView
                  style={styles.merchantList}
                  contentContainerStyle={styles.merchantListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {merchants.length === 0 ? (
                    <Text style={styles.emptyMerchantsText}>No merchants available.</Text>
                  ) : null}

                  {merchants.map((merchant) => {
                    const selected = merchant.id === newStoreMerchantId;
                    return (
                      <TouchableOpacity
                        key={merchant.id}
                        style={[
                          styles.merchantOption,
                          selected && styles.merchantOptionSelected,
                        ]}
                        onPress={() => setNewStoreMerchantId(merchant.id)}
                        activeOpacity={0.85}
                      >
                        <AppIcon
                          name="account-tie"
                          variant="community"
                          size={16}
                          color={selected ? "#0A4AA3" : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.merchantOptionText,
                            selected && styles.merchantOptionTextSelected,
                          ]}
                        >
                          {merchant.name}
                        </Text>
                        {selected ? (
                          <AppIcon
                            name="check-circle"
                            variant="community"
                            size={16}
                            color={colors.success}
                          />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.modalCancelButton}
                    onPress={() => setIsAddStoreModalOpen(false)}
                    disabled={savingNewStore}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.modalSaveButton}
                    onPress={handleAddStore}
                    disabled={savingNewStore}
                  >
                    <Text style={styles.modalSaveText}>
                      {savingNewStore ? "Saving..." : "Create"}
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

const createStyles = (colors) =>
  StyleSheet.create({
    content: {
      gap: 10,
      paddingBottom: 96,
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
    emptyText: {
      marginTop: 20,
      textAlign: "center",
      color: colors.textSubtle,
      fontSize: 13,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    body: {
      flex: 1,
    },
    assignButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.screen,
      alignItems: "center",
      justifyContent: "center",
    },
    actionCol: {
      flexDirection: "row",
      gap: 8,
    },
    storeName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    meta: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSubtle,
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
      maxHeight: "75%",
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
    },
    modalSubtitle: {
      marginTop: 4,
      marginBottom: 12,
      color: colors.textSubtle,
      fontSize: 13,
    },
    merchantList: {
      maxHeight: 320,
    },
    merchantPickerLabel: {
      marginTop: 12,
      marginBottom: 8,
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
    },
    merchantListContent: {
      gap: 8,
      paddingBottom: 6,
    },
    emptyMerchantsText: {
      textAlign: "center",
      color: colors.textSubtle,
      fontSize: 13,
      marginVertical: 10,
    },
    merchantOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.screen,
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    merchantOptionSelected: {
      borderColor: "#87B3FF",
      backgroundColor: "#DCEBFF",
    },
    merchantOptionText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    merchantOptionTextSelected: {
      color: "#0A4AA3",
      fontWeight: "600",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 14,
    },
    nameInput: {
      backgroundColor: colors.input,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
    },
    modalCancelButton: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    modalCancelText: {
      color: colors.text,
      fontWeight: "600",
    },
    modalSaveButton: {
      backgroundColor: colors.danger,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    modalSaveText: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
  });
