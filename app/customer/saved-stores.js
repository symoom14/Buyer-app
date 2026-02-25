import { useFocusEffect, useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import AppIcon from "../../src/components/AppIcon";
import { useFavorites } from "../../src/context/FavoritesContext";
import { db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

export default function CustomerSavedStores() {
  const router = useRouter();
  const { favoriteStoreIds, hasFavoriteStore, toggleFavoriteStore } = useFavorites();
  const { colors } = useAppTheme();

  const [allStores, setAllStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchStores = async () => {
    try {
      const [storesSnapshot, usersSnapshot] = await Promise.all([
        getDocs(collection(db, "stores")),
        getDocs(collection(db, "users")),
      ]);

      const sellerMap = {};
      usersSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.role === "merchant") {
          sellerMap[docSnap.id] = getUserDisplayName(data, "Unknown Seller");
        }
      });

      const stores = storesSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || "Unnamed Store",
          merchantId: data.merchantId || "",
          sellerName: sellerMap[data.merchantId] || "Unknown Seller",
        };
      });

      setAllStores(stores);
    } catch (err) {
      console.error("Error loading saved stores:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStores();
    }, []),
  );

  const stores = useMemo(() => {
    const ids = new Set(favoriteStoreIds);
    return allStores.filter((store) => ids.has(store.id));
  }, [allStores, favoriteStoreIds]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Saved stores</Text>

      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>No saved stores yet</Text>
        }
        renderItem={({ item }) => {
          const isFavoriteStore = hasFavoriteStore(item.id);
          return (
            <View style={[styles.card, styles.storeCard]}>
              <TouchableOpacity
                style={styles.storeCardMain}
                onPress={() => router.push(`/customer/store/${item.id}`)}
              >
                <View style={styles.iconWrap}>
                  <AppIcon
                    name="store"
                    variant="community"
                    size={24}
                    color={colors.text}
                  />
                </View>
                <View style={styles.contentWrap}>
                  <Text style={styles.storeName}>{item.name}</Text>
                  <Text style={styles.meta}>
                    Seller: <Text style={styles.bold}>{item.sellerName}</Text>
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.favoriteStoreButton,
                  isFavoriteStore
                    ? styles.favoriteStoreButtonRemove
                    : styles.favoriteStoreButtonAdd,
                ]}
                onPress={() => toggleFavoriteStore(item.id)}
              >
                <AppIcon
                  name={isFavoriteStore ? "store-remove" : "store-check"}
                  variant="community"
                  size={18}
                  color={isFavoriteStore ? colors.danger : colors.success}
                />
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      backgroundColor: colors.screen,
    },
    pageTitle: {
      fontSize: 26,
      fontWeight: "700",
      marginBottom: 16,
      color: colors.text,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderRadius: 8,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    storeCard: {
      padding: 0,
    },
    storeCardMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      paddingRight: 10,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 15,
    },
    contentWrap: {
      flex: 1,
    },
    storeName: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 4,
      color: colors.text,
    },
    meta: {
      fontSize: 14,
      color: colors.textMuted,
    },
    bold: {
      fontWeight: "500",
    },
    favoriteStoreButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      marginRight: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    favoriteStoreButtonAdd: {
      backgroundColor: colors.successSoft,
    },
    favoriteStoreButtonRemove: {
      backgroundColor: "#FDECEC",
    },
    empty: {
      color: colors.textSubtle,
      marginTop: 20,
    },
  });
