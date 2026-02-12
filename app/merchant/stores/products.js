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

const DEFAULT_PRODUCT_ICON = "package-variant-closed";

export default function MerchantStoresProducts() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [soldCounts, setSoldCounts] = useState({});
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockQtyInput, setRestockQtyInput] = useState("");
  const [storeMap, setStoreMap] = useState({});
  const [merchantStores, setMerchantStores] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

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
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) => {
      const name = (product.name || "").toLowerCase();
      const storeName = (storeMap[product.storeId] || "").toLowerCase();
      return name.includes(q) || storeName.includes(q);
    });
  }, [products, storeMap, searchQuery]);

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
          color="#C62828"
        />
      </TouchableOpacity>
    </View>
  );

  const handleQuickRestock = (item) => {
    setRestockTarget(item);
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
          color="#2E7D32"
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All products</Text>
      <TextInput
        placeholder="Search by product or store"
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
              <View style={styles.productCard}>
                <View style={styles.iconWrap}>
                  <AppIcon
                    name={item.iconName || DEFAULT_PRODUCT_ICON}
                    variant="community"
                    size={24}
                    color="#333"
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
              </View>
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
            />

            <TouchableOpacity style={styles.doneButton} onPress={handleDoneRestock}>
              <AppIcon name="check" variant="community" size={18} color="#fff" />
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={handleAddProduct}>
        <AppIcon name="shape-plus" variant="community" size={28} color="#fff" />
      </TouchableOpacity>
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
  search: {
    backgroundColor: "#E5E5EA",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 88,
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f2f2f2",
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
  },
  productMeta: {
    marginTop: 4,
    color: "#666",
  },
  stockStatus: {
    marginTop: 6,
    fontWeight: "600",
  },
  stockCritical: {
    color: "#C62828",
  },
  stockBackordered: {
    color: "#C62828",
  },
  stockLow: {
    color: "#EF6C00",
  },
  stockGood: {
    color: "#2E7D32",
  },
  empty: {
    color: "#666",
    marginTop: 12,
  },
  deleteActionWrap: {
    justifyContent: "center",
    alignItems: "center",
    width: 84,
    marginBottom: 12,
  },
  deleteActionButton: {
    backgroundColor: "#FFE0E6",
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
    backgroundColor: "#ccf5d7",
    justifyContent: "center",
    alignItems: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
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
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalMeta: {
    fontSize: 14,
    color: "#444",
    marginBottom: 6,
  },
  modalInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  doneButton: {
    marginTop: 12,
    backgroundColor: "#000",
    borderRadius: 8,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  doneButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    backgroundColor: "#000",
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
});
