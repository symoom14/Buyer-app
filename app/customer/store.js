import { useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AppIcon from "../../src/components/AppIcon";
import { useFavorites } from "../../src/context/FavoritesContext";
import { db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

export default function CustomerStores() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { hasFavoriteStore, toggleFavoriteStore } = useFavorites();
  const [stores, setStores] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const [storesSnapshot, usersSnapshot] = await Promise.all([
          getDocs(collection(db, "stores")),
          getDocs(collection(db, "users")),
        ]);

        const sellerMap = {};
        usersSnapshot.docs.forEach((doc) => {
          const user = doc.data();
          if (user.role === "merchant") {
            sellerMap[doc.id] = getUserDisplayName(user, "Unknown Seller");
          }
        });

        const list = storesSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "Unnamed Store",
            category: String(data.category || "").trim(),
            merchantId: data.merchantId || "",
            sellerName: sellerMap[data.merchantId] || "Unknown Seller",
          };
        });

        setStores(list);
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, []);

  const categoryOptions = useMemo(() => {
    const unique = new Set(stores.map((s) => s.category).filter(Boolean));
    return ["All", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [stores]);

  useEffect(() => {
    if (selectedCategory === "All") return;
    if (!categoryOptions.includes(selectedCategory)) {
      setSelectedCategory("All");
    }
  }, [categoryOptions, selectedCategory]);

  const visibleStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const byCategory =
      selectedCategory === "All"
        ? stores
        : stores.filter((s) => s.category === selectedCategory);

    if (!q) return byCategory;

    return byCategory.filter((store) => {
      const storeName = (store.name || "").toLowerCase();
      const sellerName = (store.sellerName || "").toLowerCase();
      return storeName.includes(q) || sellerName.includes(q);
    });
  }, [stores, searchQuery, selectedCategory]);
  const hasFiltersActive =
    searchQuery.trim().length > 0 || selectedCategory !== "All";
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Browse stores</Text>
      <TextInput
        style={styles.search}
        placeholder="Search stores or sellers"
        placeholderTextColor={colors.textSubtle}
        value={searchQuery}
        onChangeText={setSearchQuery}
        clearButtonMode="while-editing"
      />
      <View style={styles.filters}>
        {categoryOptions.map((category) => {
          const isSelected = selectedCategory === category;
          return (
            <TouchableOpacity
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={[
                styles.categoryPill,
                category === "All"
                  ? isSelected
                    ? styles.categoryAllPillSelected
                    : styles.categoryAllPill
                  : isSelected
                    ? styles.categoryPillSelected
                    : null,
              ]}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  category === "All"
                    ? isSelected
                      ? styles.categoryAllPillTextSelected
                      : styles.categoryAllPillText
                    : isSelected
                      ? styles.categoryPillTextSelected
                      : null,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {visibleStores.length === 0 ? (
          <Text style={styles.empty}>
            {hasFiltersActive
              ? "No stores matched your search"
              : "No stores available"}
          </Text>
        ) : null}
        {visibleStores.map((item) => {
          const isFavoriteStore = hasFavoriteStore(item.id);
          return (
            <View key={item.id} style={[styles.card, styles.storeCard]}>
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
                    By <Text style={styles.bold}>{item.sellerName}</Text>
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
        })}
        <View style={{ height: 8 }} />
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
    marginBottom: 12,
    color: colors.text,
  },
  search: {
    backgroundColor: colors.input,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
    color: colors.text,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  categoryPill: {
    backgroundColor: colors.pill,
    borderWidth: 1,
    borderColor: colors.pillBorder,
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryPillSelected: {
    backgroundColor: colors.pillSelected,
    borderColor: colors.pillSelectedBorder,
  },
  categoryPillText: {
    color: colors.pillText,
    fontWeight: "600",
    fontSize: 13,
  },
  categoryPillTextSelected: {
    color: colors.pillTextSelected,
  },
  categoryAllPill: {
    backgroundColor: colors.pillNeutral,
    borderColor: colors.pillNeutralBorder,
  },
  categoryAllPillSelected: {
    backgroundColor: colors.pillNeutralSelected,
    borderColor: colors.pillNeutralSelectedBorder,
  },
  categoryAllPillText: {
    color: colors.pillNeutralText,
  },
  categoryAllPillTextSelected: {
    color: colors.pillNeutralTextSelected,
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 8,
    justifyContent: "flex-start",
    alignItems: "stretch",
    flexGrow: 0,
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
  bold: {
    fontWeight: "500",
  },
  empty: {
    color: colors.textSubtle,
    marginTop: 20,
  },
});
