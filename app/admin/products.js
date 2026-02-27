import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { useRouter } from "expo-router";
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
import AddProductFab from "../../src/components/AddProductFab";
import AppIcon from "../../src/components/AppIcon";
import DeleteCircleButton from "../../src/components/DeleteCircleButton";
import ScreenContainer from "../../src/components/ScreenContainer";
import { db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";
import { logAdminAction } from "../../src/utils/adminLog";

const toCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export default function AdminProductsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [storeNameById, setStoreNameById] = useState({});
  const [stores, setStores] = useState([]);
  const [merchantNameById, setMerchantNameById] = useState({});
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState("");

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      const rows = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

      setProducts(rows);
    });

    const unsubStores = onSnapshot(collection(db, "stores"), (snap) => {
      const map = {};
      const storeRows = [];
      snap.docs.forEach((docSnap) => {
        const name = docSnap.data()?.name || "Unknown store";
        map[docSnap.id] = name;
        storeRows.push({
          id: docSnap.id,
          name,
        });
      });
      setStoreNameById(map);
      setStores(storeRows.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const map = {};
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        map[docSnap.id] = data?.name || data?.username || "Unknown merchant";
      });
      setMerchantNameById(map);
    });

    return () => {
      unsubProducts();
      unsubStores();
      unsubUsers();
    };
  }, []);

  const visibleProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;

    return products.filter((product) => {
      const name = String(product.name || "").toLowerCase();
      const storeName = String(storeNameById[product.storeId] || "").toLowerCase();
      const merchantName = String(merchantNameById[product.merchantId] || "").toLowerCase();
      return name.includes(q) || storeName.includes(q) || merchantName.includes(q);
    });
  }, [searchQuery, products, storeNameById, merchantNameById]);

  const confirmDeleteProduct = (product) => {
    Alert.alert(
      "Delete product",
      `Delete ${product.name || "this product"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "products", product.id));
              await logAdminAction({
                action: "product_deleted",
                targetType: "product",
                targetId: product.id,
                targetLabel: product.name || "",
                metadata: {
                  storeId: product.storeId || "",
                  merchantId: product.merchantId || "",
                },
              });
            } catch (_error) {
              Alert.alert("Failed", "Could not delete product.");
            }
          },
        },
      ],
    );
  };

  const openAddProductModal = () => {
    setSelectedStoreId("");
    setIsAddProductModalOpen(true);
  };

  const handleStartAddProduct = () => {
    if (!selectedStoreId) {
      Alert.alert("Select store", "Please choose a store first.");
      return;
    }
    setIsAddProductModalOpen(false);
    router.push(`/admin/store/add-product/${selectedStoreId}`);
  };

  return (
    <ScreenContainer disableBottomInset bottomPadding={12}>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search by product, store, or merchant"
        placeholderTextColor={colors.textSubtle}
        style={styles.searchInput}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {visibleProducts.length === 0 ? (
          <Text style={styles.emptyText}>No products found.</Text>
        ) : null}

        {visibleProducts.map((product) => (
          <Pressable
            key={product.id}
            style={styles.card}
            onPress={() => router.push(`/admin/store/edit-product/${product.id}`)}
          >
            <View style={styles.iconWrap}>
              <AppIcon
                name={product.iconName || "package-variant-closed"}
                variant="community"
                size={18}
                color={colors.text}
              />
            </View>

            <View style={styles.body}>
              <Text style={styles.productName}>{product.name || "Unnamed Product"}</Text>
              <Text style={styles.meta}>Store: {storeNameById[product.storeId] || "Unknown store"}</Text>
              <Text style={styles.meta}>
                Merchant: {merchantNameById[product.merchantId] || "Unknown merchant"}
              </Text>
              <Text style={styles.meta}>
                Price: {toCurrency(product.price)}  Quantity: {Number(product.quantity || 0)}
              </Text>
            </View>

            <DeleteCircleButton
              size={32}
              onPress={(e) => {
                e.stopPropagation();
                confirmDeleteProduct(product);
              }}
            />
          </Pressable>
        ))}
      </ScrollView>

      <AddProductFab onPress={openAddProductModal} />

      <Modal
        visible={isAddProductModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddProductModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsAddProductModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Choose Store</Text>
                <Text style={styles.modalSubtitle}>Add product to selected store</Text>

                <ScrollView
                  style={styles.storeList}
                  contentContainerStyle={styles.storeListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {stores.length === 0 ? (
                    <Text style={styles.emptyStoresText}>No stores available.</Text>
                  ) : null}
                  {stores.map((store) => {
                    const isSelected = selectedStoreId === store.id;
                    return (
                      <TouchableOpacity
                        key={store.id}
                        style={[
                          styles.storeOption,
                          isSelected && styles.storeOptionSelected,
                        ]}
                        onPress={() => setSelectedStoreId(store.id)}
                        activeOpacity={0.85}
                      >
                        <AppIcon
                          name="store"
                          variant="community"
                          size={16}
                          color={isSelected ? "#0A4AA3" : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.storeOptionText,
                            isSelected && styles.storeOptionTextSelected,
                          ]}
                        >
                          {store.name}
                        </Text>
                        {isSelected ? (
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
                    onPress={() => setIsAddProductModalOpen(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.modalSaveButton}
                    onPress={handleStartAddProduct}
                  >
                    <Text style={styles.modalSaveText}>Continue</Text>
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
    searchInput: {
      backgroundColor: colors.input,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      marginBottom: 12,
    },
    content: {
      gap: 10,
      paddingBottom: 96,
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
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    body: {
      flex: 1,
    },
    productName: {
      fontSize: 14,
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
    storeList: {
      maxHeight: 320,
    },
    storeListContent: {
      gap: 8,
      paddingBottom: 6,
    },
    emptyStoresText: {
      textAlign: "center",
      color: colors.textSubtle,
      fontSize: 13,
      marginVertical: 10,
    },
    storeOption: {
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
    storeOptionSelected: {
      borderColor: "#87B3FF",
      backgroundColor: "#DCEBFF",
    },
    storeOptionText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    storeOptionTextSelected: {
      color: "#0A4AA3",
      fontWeight: "600",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 14,
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
