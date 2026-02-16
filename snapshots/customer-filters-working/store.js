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
import { db } from "../../src/firebase/firebaseConfig";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

export default function CustomerStores() {
  const router = useRouter();
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
        {visibleStores.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => router.push(`/customer/store/${item.id}`)}
          >
            <View style={styles.iconWrap}>
              <AppIcon
                name="store"
                variant="community"
                size={24}
                color="#333"
              />
            </View>
            <View style={styles.contentWrap}>
              <Text style={styles.storeName}>{item.name}</Text>
              <Text style={styles.meta}>
                Seller: <Text style={styles.bold}>{item.sellerName}</Text>
              </Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 8 }} />
      </ScrollView>
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
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 12,
  },
  search: {
    backgroundColor: "#E5E5EA",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  categoryPill: {
    backgroundColor: "#EAF1FF",
    borderWidth: 1,
    borderColor: "#C9D9FF",
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryPillSelected: {
    backgroundColor: "#D8E7FF",
    borderColor: "#95B7FF",
  },
  categoryPillText: {
    color: "#2357B8",
    fontWeight: "600",
    fontSize: 13,
  },
  categoryPillTextSelected: {
    color: "#18479E",
  },
  categoryAllPill: {
    backgroundColor: "#F2F2F7",
    borderColor: "#DADAE0",
  },
  categoryAllPillSelected: {
    backgroundColor: "#DDDEE6",
    borderColor: "#BCBEC9",
  },
  categoryAllPillText: {
    color: "#4B4E5A",
  },
  categoryAllPillTextSelected: {
    color: "#333642",
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
    borderColor: "#eee",
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f2f2f2",
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
  },
  meta: {
    fontSize: 14,
    color: "#555",
  },
  bold: {
    fontWeight: "500",
  },
  empty: {
    color: "#666",
    marginTop: 20,
  },
});
