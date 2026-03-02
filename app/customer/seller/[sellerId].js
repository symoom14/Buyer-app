import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import AppIcon from "../../../src/components/AppIcon";
import { useFavorites } from "../../../src/context/FavoritesContext";
import { db } from "../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../src/theme/useAppTheme";
import { fetchMerchantRatingSummary } from "../../../src/utils/reviews";
import { getUserDisplayName } from "../../../src/utils/userDisplayName";

export default function CustomerSellerStoresPage() {
  const router = useRouter();
  const { sellerId } = useLocalSearchParams();
  const { colors } = useAppTheme();
  const { hasFavoriteStore, toggleFavoriteStore } = useFavorites();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [stores, setStores] = useState([]);
  const [sellerName, setSellerName] = useState("Seller");
  const [sellerRating, setSellerRating] = useState({ average: 0, count: 0 });
  const [loading, setLoading] = useState(true);

  const fetchSellerStores = useCallback(async () => {
    try {
      const [storesSnapshot, sellerSnapshot] = await Promise.all([
        getDocs(
          query(collection(db, "stores"), where("merchantId", "==", String(sellerId))),
        ),
        getDoc(doc(db, "users", String(sellerId))),
      ]);

      if (sellerSnapshot.exists()) {
        setSellerName(getUserDisplayName(sellerSnapshot.data(), "Seller"));
      }
      const ratingSummary = await fetchMerchantRatingSummary(db, sellerId);
      setSellerRating(ratingSummary);

      const list = storesSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || "Unnamed Store",
        };
      });

      setStores(list);
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    fetchSellerStores();
  }, [fetchSellerStores]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{sellerName}</Text>
      <View style={styles.subtitleRow}>
        <Text style={styles.subtitle}>Stores by this seller</Text>
        <View style={styles.ratingChip}>
          <AppIcon
            name={sellerRating.count > 0 ? "star" : "star-settings-outline"}
            variant="community"
            size={13}
            color="#F4B400"
          />
          <Text style={styles.ratingChipText}>
            {sellerRating.count > 0
              ? `${sellerRating.average.toFixed(1)} (${sellerRating.count})`
              : "0"}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {stores.length === 0 ? (
          <Text style={styles.empty}>No stores available for this seller</Text>
        ) : null}

        {stores.map((store) => {
          const isFavoriteStore = hasFavoriteStore(store.id);
          return (
            <View key={store.id} style={[styles.card, styles.storeCard]}>
              <TouchableOpacity
                style={styles.storeCardMain}
                onPress={() => router.push(`/customer/store/${store.id}`)}
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
                  <Text style={styles.storeName}>{store.name}</Text>
                  <Text style={styles.meta}>Tap to view store products</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.favoriteStoreButton,
                  isFavoriteStore
                    ? styles.favoriteStoreButtonRemove
                    : styles.favoriteStoreButtonAdd,
                ]}
                onPress={() => toggleFavoriteStore(store.id)}
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
        })}
      </ScrollView>
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
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      marginTop: 4,
      marginBottom: 0,
      color: colors.textMuted,
      fontSize: 14,
    },
    subtitleRow: {
      marginTop: 4,
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    ratingChip: {
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    ratingChipText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "600",
    },
    listContent: {
      paddingBottom: 8,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
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
    empty: {
      color: colors.textSubtle,
      marginTop: 20,
    },
  });
