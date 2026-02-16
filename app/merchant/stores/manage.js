import { useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import AppIcon from "../../../src/components/AppIcon";
import EmptyFieldState from "../../../src/components/EmptyFieldState";
import { auth, db } from "../../../src/firebase/firebaseConfig";

export default function MerchantStoresManage() {
  const [stores, setStores] = useState([]);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameInput, setRenameInput] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const router = useRouter();

  const fetchStores = async (merchantId) => {
    const storesQuery = query(
      collection(db, "stores"),
      where("merchantId", "==", merchantId),
    );
    const productsQuery = query(
      collection(db, "products"),
      where("merchantId", "==", merchantId),
    );

    const [storesSnapshot, productsSnapshot] = await Promise.all([
      getDocs(storesQuery),
      getDocs(productsQuery),
    ]);

    const productCountByStore = {};
    productsSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const id = data.storeId;
      if (!id) return;
      productCountByStore[id] = (productCountByStore[id] || 0) + 1;
    });

    const list = storesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      productCount: productCountByStore[doc.id] || 0,
    }));

    setStores(list);
  };

  useFocusEffect(
    useCallback(() => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) fetchStores(user.uid);
      });
      return unsub;
    }, []),
  );

  const handleDeleteStore = (storeId) => {
    Alert.alert(
      "Delete store?",
      "Are you sure you want to delete this store?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "stores", storeId));
            setStores((prev) => prev.filter((store) => store.id !== storeId));
          },
        },
      ],
    );
  };

  const renderRightActions = (storeId) => (
    <View style={styles.deleteActionWrap}>
      <TouchableOpacity
        style={styles.deleteCircle}
        onPress={() => handleDeleteStore(storeId)}
      >
        <AppIcon
          name="store-remove"
          variant="community"
          size={24}
          color="#C62828"
        />
      </TouchableOpacity>
    </View>
  );

  const openRenameModal = (store) => {
    setRenameTarget(store);
    setRenameInput(store?.name || "");
  };

  const handleRenameStore = async () => {
    if (!renameTarget || savingRename) return;
    const nextName = renameInput.trim();
    if (!nextName) {
      Alert.alert("Invalid name", "Store name cannot be empty.");
      return;
    }

    try {
      setSavingRename(true);
      await updateDoc(doc(db, "stores", renameTarget.id), { name: nextName });
      setStores((prev) =>
        prev.map((store) =>
          store.id === renameTarget.id ? { ...store, name: nextName } : store,
        ),
      );
      setRenameTarget(null);
      setRenameInput("");
    } finally {
      setSavingRename(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your stores</Text>
      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          stores.length === 0 ? styles.listEmptyContainer : undefined
        }
        ListEmptyComponent={
          <EmptyFieldState message="Empty as a field. Create a new store to start selling!" />
        }
        renderItem={({ item }) => (
          <Swipeable renderRightActions={() => renderRightActions(item.id)}>
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/merchant/store/${item.id}`)}
            >
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.name}</Text>
                <TouchableOpacity
                  style={styles.renameButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    openRenameModal(item);
                  }}
                >
                  <AppIcon
                    name="pencil-outline"
                    variant="community"
                    size={18}
                    color="#333"
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.meta}>
                Products: {item.productCount || 0}
              </Text>
              <Text style={styles.meta}>
                Date opened:{" "}
                {item.createdAt?.toDate?.().toLocaleDateString?.() || "—"}
              </Text>
            </Pressable>
          </Swipeable>
        )}
      />

      <Modal
        visible={!!renameTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setRenameTarget(null)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Change store name</Text>
            <TextInput
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder="Enter store name"
              style={styles.modalInput}
              autoFocus
              maxLength={80}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setRenameTarget(null)}
                disabled={savingRename}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={handleRenameStore}
                disabled={savingRename}
              >
                <Text style={styles.doneButtonText}>
                  {savingRename ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F2F2F7",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deleteActionWrap: {
    justifyContent: "center",
    alignItems: "center",
    width: 84,
    marginBottom: 12,
  },
  deleteCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFE0E6",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  renameButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  meta: {
    fontSize: 13,
    color: "#666",
    marginBottom: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  modalInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 2,
  },
  cancelButton: {
    height: 34,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#E5E5EA",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "#333",
    fontWeight: "600",
  },
  doneButton: {
    height: 34,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  listEmptyContainer: {
    flexGrow: 1,
  },
});
