import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { db } from "../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../src/theme/useAppTheme";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";

export default function StorePage() {
  const { storeId } = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [products, setProducts] = useState([]);
  const [soldCounts, setSoldCounts] = useState({});
  const [storeName, setStoreName] = useState("Store");
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [storeNameInput, setStoreNameInput] = useState("");
  const [savingStoreName, setSavingStoreName] = useState(false);
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockQtyInput, setRestockQtyInput] = useState("");
  const [fabVisible, setFabVisible] = useState(true);
  const lastOffsetY = useRef(0);
  const fabAnim = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const fetchProducts = useCallback(async () => {
    const storeSnap = await getDoc(doc(db, "stores", String(storeId)));
    if (storeSnap.exists()) {
      const currentStoreName = storeSnap.data()?.name || "Store";
      setStoreName(currentStoreName);
      setStoreNameInput(currentStoreName);
    }

    const q = query(
      collection(db, "products"),
      where("storeId", "==", storeId),
    );

    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setProducts(list);

    const orderSnap = await getDocs(collection(db, "orders"));
    const counts = {};
    orderSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      (data.items || []).forEach((item) => {
        if (!item.productId) return;
        counts[item.productId] =
          (counts[item.productId] || 0) + (item.quantity || 0);
      });
    });
    setSoldCounts(counts);
  }, [storeId]);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts]),
  );

  const handleDelete = async (productId) => {
    Alert.alert(
      "Delete product?",
      "Are you sure you want to delete this product?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "products", productId));
            fetchProducts();
          },
        },
      ],
    );
  };

  const renderRightActions = (productId) => (
    <View style={styles.deleteActionWrap}>
      <TouchableOpacity
        style={styles.deleteActionButton}
        onPress={() => handleDelete(productId)}
      >
        <AppIcon
          name="package-variant-closed-remove"
          variant="community"
          size={24}
          color={colors.danger}
        />
      </TouchableOpacity>
    </View>
  );

  const handleQuickRestock = (product) => {
    setRestockTarget(product);
    setRestockQtyInput("");
  };

  const handleDoneRestock = async () => {
    if (!restockTarget) return;
    const restockAmount = Number(restockQtyInput);
    const originalQty = Number(restockTarget.quantity || 0);
    const orderedCount = soldCounts[restockTarget.id] || 0;
    const updatedRemainingQty = originalQty - orderedCount + restockAmount;
    const nextQty = orderedCount + updatedRemainingQty;
    if (Number.isNaN(restockAmount) || restockAmount < 0) {
      Alert.alert("Invalid quantity", "Please enter a valid restock amount.");
      return;
    }
    if (updatedRemainingQty < 0) {
      const minimumRestockAmount = Math.max(0, orderedCount - originalQty);
      Alert.alert(
        "Quantity too low",
        `Restock amount must be at least ${minimumRestockAmount}.`,
      );
      return;
    }

    await updateDoc(doc(db, "products", restockTarget.id), { quantity: nextQty });
    setProducts((prev) =>
      prev.map((p) => (p.id === restockTarget.id ? { ...p, quantity: nextQty } : p)),
    );
    setRestockTarget(null);
  };

  const renderLeftActions = (item) => (
    <View style={styles.restockActionWrap}>
      <TouchableOpacity
        style={styles.restockActionButton}
        onPress={() => handleQuickRestock(item)}
      >
        <AppIcon
          name="package-variant-plus"
          variant="community"
          size={24}
          color={colors.success}
        />
      </TouchableOpacity>
    </View>
  );

  const handleSaveStoreName = async () => {
    const nextName = storeNameInput.trim();
    if (!nextName) {
      Alert.alert("Invalid name", "Store name cannot be empty.");
      return;
    }
    if (savingStoreName) return;

    try {
      setSavingStoreName(true);
      await updateDoc(doc(db, "stores", String(storeId)), { name: nextName });
      setStoreName(nextName);
      setNameModalVisible(false);
    } finally {
      setSavingStoreName(false);
    }
  };

  const setFabVisibility = (visible) => {
    if (visible === fabVisible) return;
    setFabVisible(visible);
    Animated.timing(fabAnim, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const handleScroll = (event) => {
    const y = event.nativeEvent.contentOffset.y;
    const diff = y - lastOffsetY.current;

    if (y <= 0) {
      setFabVisibility(true);
    } else if (diff > 6) {
      setFabVisibility(false);
    } else if (diff < -6) {
      setFabVisibility(true);
    }

    lastOffsetY.current = y;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{storeName}</Text>
      <TouchableOpacity
        style={styles.renameCard}
        onPress={() => setNameModalVisible(true)}
      >
        <View style={styles.renameCardLeft}>
          <AppIcon name="store-edit-outline" variant="community" size={20} />
          <Text style={styles.renameCardText}>Change store name</Text>
        </View>
        <AppIcon
          name="chevron-right"
          variant="community"
          size={18}
          color={colors.textSubtle}
        />
      </TouchableOpacity>
      <Text style={styles.subtitle}>Store Products</Text>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListEmptyComponent={<Text style={styles.empty}>No products yet</Text>}
        renderItem={({ item }) => {
          const orderedCount = soldCounts[item.id] || 0;
          const remainingStock = Number(item.quantity || 0) - orderedCount;
          const isBackordered = remainingStock < 0;

          return (
            <Swipeable
              renderLeftActions={() => renderLeftActions(item)}
              renderRightActions={() => renderRightActions(item.id)}
            >
              <Pressable
                style={styles.productCard}
                onPress={() =>
                  router.push(`/merchant/store/edit-product/${item.id}`)
                }
              >
                <View style={styles.iconWrap}>
                  <AppIcon
                    name={item.iconName || DEFAULT_PRODUCT_ICON}
                    variant="community"
                    size={24}
                    color={colors.text}
                  />
                </View>

                <View style={styles.contentWrap}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productMeta}>
                    ${item.price} · Qty: {item.quantity}
                  </Text>
                  <Text style={styles.productMeta}>
                    Ordered: {orderedCount}
                  </Text>
                  <Text
                    style={[
                      styles.stockStatus,
                      isBackordered
                        ? styles.stockBackordered
                        : remainingStock < 5
                          ? styles.stockCritical
                          : remainingStock <= 10
                            ? styles.stockLow
                            : styles.stockGood,
                    ]}
                  >
                    {isBackordered
                      ? "Product back-ordered"
                      : `${remainingStock} left in stock`}
                  </Text>
                </View>
              </Pressable>
            </Swipeable>
          );
        }}
      />

      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setNameModalVisible(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Change store name</Text>
            <TextInput
              style={styles.modalInput}
              value={storeNameInput}
              onChangeText={setStoreNameInput}
              placeholder="Enter store name"
              placeholderTextColor={colors.textSubtle}
              autoFocus
              maxLength={80}
            />

            <View style={styles.renameModalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setNameModalVisible(false)}
                disabled={savingStoreName}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.renameDoneButton}
                onPress={handleSaveStoreName}
                disabled={savingStoreName}
              >
                <Text style={styles.renameDoneButtonText}>
                  {savingStoreName ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!restockTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRestockTarget(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setRestockTarget(null)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Quick restock</Text>
            <Text style={styles.modalMeta}>
              Current quantity: {restockTarget?.quantity ?? 0}
            </Text>
            <Text style={styles.modalMeta}>
              Demand:{" "}
              {Math.max(
                0,
                (soldCounts[restockTarget?.id] || 0) -
                  Number(restockTarget?.quantity || 0),
              )}
            </Text>
            <Text style={styles.modalMeta}>
              Ordered: {soldCounts[restockTarget?.id] || 0}
            </Text>

            <TextInput
              style={styles.modalInput}
              value={restockQtyInput}
              onChangeText={setRestockQtyInput}
              keyboardType="numeric"
              placeholder="Enter restock amount"
              placeholderTextColor={colors.textSubtle}
            />

            <TouchableOpacity style={styles.doneButton} onPress={handleDoneRestock}>
              <AppIcon
                name="check"
                variant="community"
                size={18}
                color={colors.background}
              />
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Animated.View
        style={[
          styles.fabWrap,
          {
            opacity: fabAnim,
            transform: [
              {
                translateY: fabAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={fabVisible ? "auto" : "none"}
      >
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push(`/merchant/store/add-product/${storeId}`)}
        >
          <AppIcon
            name="shape-plus"
            variant="community"
            size={28}
            color={colors.background}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors, isDark) =>
  StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.screen,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 12,
  },
  renameCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  renameCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  renameCardText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  contentWrap: {
    flex: 1,
  },
  productName: {
    fontWeight: "600",
    fontSize: 16,
    color: colors.text,
  },
  productMeta: {
    marginTop: 4,
    color: colors.textMuted,
  },
  stockStatus: {
    marginTop: 6,
    fontWeight: "600",
  },
  stockCritical: {
    color: colors.danger,
  },
  stockBackordered: {
    color: colors.danger,
  },
  stockLow: {
    color: colors.warning,
  },
  stockGood: {
    color: colors.success,
  },
  empty: {
    color: colors.textSubtle,
    marginTop: 12,
  },
  deleteActionWrap: {
    justifyContent: "center",
    alignItems: "center",
    width: 84,
    marginBottom: 12,
  },
  deleteActionButton: {
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  restockActionWrap: {
    justifyContent: "center",
    alignItems: "center",
    width: 84,
    marginBottom: 12,
  },
  restockActionButton: {
    backgroundColor: colors.successSoft,
    justifyContent: "center",
    alignItems: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.28)",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
    color: colors.text,
  },
  modalMeta: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 6,
  },
  modalInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  renameModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
  },
  cancelButton: {
    height: 34,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  renameDoneButton: {
    height: 34,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  renameDoneButtonText: {
    color: colors.background,
    fontWeight: "600",
  },
  doneButton: {
    marginTop: 12,
    backgroundColor: colors.text,
    borderRadius: 8,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  doneButtonText: {
    color: colors.background,
    fontWeight: "600",
  },
  fabWrap: {
    position: "absolute",
    right: 20,
    bottom: 50,
  },
  fab: {
    backgroundColor: colors.text,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
});
