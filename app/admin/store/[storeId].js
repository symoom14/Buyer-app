import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AddProductFab from "../../../src/components/AddProductFab";
import AppIcon from "../../../src/components/AppIcon";
import DeleteCircleButton from "../../../src/components/DeleteCircleButton";
import ScreenContainer from "../../../src/components/ScreenContainer";
import { db } from "../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../src/theme/useAppTheme";
import { logAdminAction } from "../../../src/utils/adminLog";

const toCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export default function AdminStoreProductsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const storeId = Array.isArray(params.storeId) ? params.storeId[0] : params.storeId;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [storeName, setStoreName] = useState("Store");
  const [products, setProducts] = useState([]);

  const confirmDeleteProduct = (product) => {
    Alert.alert(
      "Delete product",
      `Delete ${product.name || "this product"} from the store?`,
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
                  storeId: storeId || "",
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

  useEffect(() => {
    if (!storeId) return undefined;

    const unsubStore = onSnapshot(doc(db, "stores", storeId), (snap) => {
      if (!snap.exists()) {
        setStoreName("Unknown store");
        return;
      }
      setStoreName(snap.data()?.name || "Unnamed Store");
    });

    const productsQuery = query(
      collection(db, "products"),
      where("storeId", "==", storeId),
    );

    const unsubProducts = onSnapshot(productsQuery, (snap) => {
      const rows = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

      setProducts(rows);
    });

    return () => {
      unsubStore();
      unsubProducts();
    };
  }, [storeId]);

  return (
    <ScreenContainer disableBottomInset bottomPadding={12}>
      <Text style={styles.title}>{storeName}</Text>
      <Text style={styles.subtitle}>Products: {products.length}</Text>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {products.length === 0 ? (
          <Text style={styles.empty}>No products found for this store.</Text>
        ) : null}

        {products.map((product) => (
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
              <Text style={styles.name}>{product.name || "Unnamed Product"}</Text>
              <Text style={styles.meta}>Price: {toCurrency(product.price)}</Text>
              <Text style={styles.meta}>Quantity: {Number(product.quantity || 0)}</Text>
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

      <AddProductFab
        onPress={() => {
          if (!storeId) return;
          router.push(`/admin/store/add-product/${storeId}`);
        }}
      />
    </ScreenContainer>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      marginTop: 4,
      marginBottom: 12,
      fontSize: 13,
      color: colors.textSubtle,
    },
    list: {
      gap: 10,
      paddingBottom: 96,
    },
    empty: {
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
    name: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    meta: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSubtle,
    },
  });
