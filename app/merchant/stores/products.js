import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
import { useCallback, useMemo, useState } from "react";
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
import { auth, db } from "../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../src/theme/useAppTheme";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const LOW_STOCK_THRESHOLD = 10;

export default function MerchantStoresProducts() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [products, setProducts] = useState([]);
  const [soldCounts, setSoldCounts] = useState({});
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockQtyInput, setRestockQtyInput] = useState("");
  const [storeSwitchTarget, setStoreSwitchTarget] = useState(null);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [storeMap, setStoreMap] = useState({});
  const [merchantStores, setMerchantStores] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const fetchProducts = async (merchantId) => {
    const q = query(
      collection(db, "products"),
      where("merchantId", "==", merchantId),
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

    const storesQuery = query(
      collection(db, "stores"),
      where("merchantId", "==", merchantId),
    );
    const storeSnap = await getDocs(storesQuery);
    const map = {};
    const stores = [];
    storeSnap.docs.forEach((docSnap) => {
      map[docSnap.id] = docSnap.data().name;
      stores.push({ id: docSnap.id, name: docSnap.data().name || "Store" });
    });
    setStoreMap(map);
    setMerchantStores(stores);
  };

  useFocusEffect(
    useCallback(() => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) fetchProducts(user.uid);
      });
      return unsub;
    }, []),
  );

  const visibleProducts = useMemo(() => {
    const lowStockOnly =
      (Array.isArray(params?.stock) ? params.stock[0] : params?.stock) === "low";
    const source = lowStockOnly
      ? products.filter((product) => Number(product.quantity || 0) <= LOW_STOCK_THRESHOLD)
      : products;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return source;
    return source.filter((product) => {
      const name = (product.name || "").toLowerCase();
      const storeName = (storeMap[product.storeId] || "").toLowerCase();
      return name.includes(q) || storeName.includes(q);
    });
  }, [params?.stock, products, storeMap, searchQuery]);

  const handleAddProduct = () => {
    if (merchantStores.length === 0) {
      Alert.alert(
        "No stores yet",
        "Create a store first before adding a product.",
      );
      return;
    }

    if (merchantStores.length === 1) {
      router.push(`/merchant/store/add-product/${merchantStores[0].id}`);
      return;
    }

    Alert.alert(
      "Choose a store",
      "Select which store you want to add a product to.",
      [
        ...merchantStores.slice(0, 6).map((store) => ({
          text: store.name,
          onPress: () => router.push(`/merchant/store/add-product/${store.id}`),
        })),
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const handleDeleteProduct = (productId) => {
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
            setProducts((prev) =>
              prev.filter((product) => product.id !== productId),
            );
            setSoldCounts((prev) => {
              const next = { ...prev };
              delete next[productId];
              return next;
            });
          },
        },
      ],
    );
  };

  const renderRightActions = (productId) => (
    <View style={styles.deleteActionWrap}>
      <TouchableOpacity
        style={styles.deleteActionButton}
        onPress={() => handleDeleteProduct(productId)}
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

  const handleQuickRestock = (item) => {
    setRestockTarget(item);
    setRestockQtyInput("");
  };

  const handleOpenStoreSwitch = (item) => {
    setStoreSwitchTarget(item);
    setSelectedStoreId(item.storeId || "");
  };

  const handleDoneStoreSwitch = async () => {
    if (!storeSwitchTarget || !selectedStoreId) return;

    await updateDoc(doc(db, "products", storeSwitchTarget.id), {
      storeId: selectedStoreId,
    });

    setProducts((prev) =>
      prev.map((p) =>
        p.id === storeSwitchTarget.id ? { ...p, storeId: selectedStoreId } : p,
      ),
    );
    setStoreSwitchTarget(null);
    setSelectedStoreId("");
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

    await updateDoc(doc(db, "products", restockTarget.id), {
      quantity: nextQty,
    });
    setProducts((prev) =>
      prev.map((p) =>
        p.id === restockTarget.id ? { ...p, quantity: nextQty } : p,
      ),
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
      <TouchableOpacity
        style={styles.switchStoreActionButton}
        onPress={() => handleOpenStoreSwitch(item)}
      >
        <AppIcon
          name="store-cog-outline"
          variant="community"
          size={23}
          color={colors.tint}
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All products</Text>
      <TextInput
        placeholder="Search by product or store"
        placeholderTextColor={colors.textSubtle}
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.search}
        clearButtonMode="while-editing"
      />
      <FlatList
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
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
                    Store: {storeMap[item.storeId] || "Unknown store"}
                  </Text>
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

            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleDoneRestock}
            >
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

      <Modal
        visible={!!storeSwitchTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setStoreSwitchTarget(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setStoreSwitchTarget(null)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Switch store</Text>
            <Text style={styles.modalMeta}>
              Product: {storeSwitchTarget?.name || "Unnamed product"}
            </Text>

            <View style={styles.radioList}>
              {merchantStores.map((store) => {
                const selected = selectedStoreId === store.id;
                return (
                  <TouchableOpacity
                    key={store.id}
                    style={styles.radioRow}
                    onPress={() => setSelectedStoreId(store.id)}
                  >
                    <View style={styles.radioOuter}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={styles.radioLabel}>{store.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleDoneStoreSwitch}
            >
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

      <TouchableOpacity style={styles.fab} onPress={handleAddProduct}>
        <AppIcon
          name="shape-plus"
          variant="community"
          size={28}
          color={colors.background}
        />
      </TouchableOpacity>
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
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    color: colors.text,
  },
  search: {
    backgroundColor: colors.input,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 12,
    color: colors.text,
  },
  listContent: {
    paddingBottom: 88,
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 14,
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
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  productMeta: {
    marginTop: 4,
    color: colors.textSubtle,
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
    flexDirection: "row",
    width: 150,
    marginBottom: 12,
    gap: 10,
  },
  restockActionButton: {
    backgroundColor: colors.successSoft,
    justifyContent: "center",
    alignItems: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  switchStoreActionButton: {
    backgroundColor: colors.pill,
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
  radioList: {
    marginTop: 8,
    marginBottom: 2,
    gap: 8,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.text,
  },
  radioLabel: {
    fontSize: 15,
    color: colors.text,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    backgroundColor: colors.text,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
});
