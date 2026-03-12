import { useRouter } from "expo-router";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AppIcon from "../../src/components/AppIcon";
import { useCart } from "../../src/context/CartContext";
import { db } from "../../src/firebase/firebaseConfig";
import {
  PRODUCT_SORT_MODES,
  sortProducts,
} from "../../src/utils/productSorting";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const ICON_COLOR_POOL = [
  "#E53935",
  "#2E7D32",
  "#1E88E5",
  "#FFA700",
  "#F57C00",
];

export default function CustomerProducts() {
  const router = useRouter();
  const { addToCart } = useCart();

  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  const getRandomIconColor = () => {
    const idx = Math.floor(Math.random() * ICON_COLOR_POOL.length);
    return ICON_COLOR_POOL[idx];
  };

  const fetchProducts = async () => {
    try {
      const productsQuery = query(
        collection(db, "products"),
        orderBy("createdAt", "desc"),
      );
      const productSnapshot = await getDocs(productsQuery);

      const rawProducts = productSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));


      const storeSnapshot = await getDocs(collection(db, "stores"));
      const storeMap = {};
      const storeList = [];
      storeSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        storeMap[doc.id] = data.name;
        storeList.push({
          id: doc.id,
          name: data.name || "Unknown Store",
          merchantId: data.merchantId || "",
        });
      });
      setStores(storeList);


      const userSnapshot = await getDocs(collection(db, "users"));
      const merchantMap = {};
      const merchantList = [];
      userSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.role === "merchant") {
          const sellerName = getUserDisplayName(data, "Unknown Seller");
          merchantMap[doc.id] = sellerName;
          merchantList.push({
            id: doc.id,
            name: sellerName,
          });
        }
      });
      setSellers(merchantList);

      const enrichedProducts = rawProducts.map((product) => ({
        ...product,
        storeName: storeMap[product.storeId] || "Unknown Store",
        sellerName: merchantMap[product.merchantId] || "Unknown Seller",
        iconColor: getRandomIconColor(),
      }));

      setProducts(enrichedProducts);
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  const categoryOptions = useMemo(() => {
    const unique = new Set(
      products.map((p) => String(p.category || "").trim()).filter(Boolean),
    );
    return ["All", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const categoryFilteredProducts = useMemo(() => {
    if (selectedCategory === "All") return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const sortedCategoryProducts = useMemo(
    () =>
      sortProducts(categoryFilteredProducts, PRODUCT_SORT_MODES.RECOMMENDED),
    [categoryFilteredProducts],
  );

  const productResults = useMemo(() => {
    if (!isSearching) return [];
    return sortProducts(
      categoryFilteredProducts.filter((product) => {
        const productName = (product.name || "").toLowerCase();
        return productName.includes(trimmedQuery);
      }),
      PRODUCT_SORT_MODES.RECOMMENDED,
    );
  }, [categoryFilteredProducts, isSearching, trimmedQuery]);

  const storeResults = useMemo(() => {
    if (!isSearching) return [];
    return stores.filter((store) =>
      (store.name || "").toLowerCase().includes(trimmedQuery),
    );
  }, [isSearching, stores, trimmedQuery]);

  const sellerResults = useMemo(() => {
    if (!isSearching) return [];
    return sellers.filter((seller) =>
      (seller.name || "").toLowerCase().includes(trimmedQuery),
    );
  }, [isSearching, sellers, trimmedQuery]);

  const handleQuickAddToCart = (product) => {
    addToCart({
      productId: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      quantity: 1,
      storeId: product.storeId,
      storeName: product.storeName || "Unknown Store",
      merchantId: product.merchantId || "unknown",
      merchantName: product.sellerName || "Unknown Seller",
    });
  };

  const renderProductCard = (product, key) => (
    <View key={key} style={[styles.card, styles.productCard]}>
      <TouchableOpacity
        style={styles.productCardMain}
        onPress={() => router.push(`/customer/product/${product.id}`)}
      >
        <View style={styles.iconWrap}>
          <AppIcon
            name={product.iconName || DEFAULT_PRODUCT_ICON}
            variant="community"
            size={27}
            color={product.iconColor || "#333"}
          />
        </View>

        <View style={styles.contentWrap}>
          <Text style={styles.productName}>{product.name}</Text>

          <View style={styles.metaWrap}>
            <Text style={styles.sellerStoreText}>{product.sellerName}</Text>
            <View style={styles.storeRow}>
              <View style={styles.arrowChip}>
                <AppIcon
                  name="chevron-right"
                  variant="community"
                  size={14}
                  color="#5C5C5C"
                />
              </View>
              <Text style={styles.sellerStoreText}>{product.storeName}</Text>
            </View>
          </View>

          <Text style={styles.price}>${product.price}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickAddButton}
        onPress={() => handleQuickAddToCart(product)}
      >
        <AppIcon
          name="basket-plus"
          variant="community"
          size={18}
          color="#1E8E3E"
        />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Latest products in store</Text>
      <TextInput
        style={styles.search}
        placeholder="Search products, stores, sellers"
        value={searchQuery}
        onChangeText={setSearchQuery}
        clearButtonMode="while-editing"
      />
      <View style={styles.filters}>
        {categoryOptions.map((category) => {
          const isSelected = category === selectedCategory;
          const isAll = category === "All";
          return (
            <TouchableOpacity
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={[
                styles.categoryPill,
                isAll
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
                  isAll
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

      {isSearching ? (
        <FlatList
          data={[
            { key: "stores", title: "Stores", items: storeResults },
            { key: "sellers", title: "Sellers", items: sellerResults },
            { key: "products", title: "Products", items: productResults },
          ]}
          keyExtractor={(item) => item.key}
          centerContent={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<View style={{ height: 8 }} />}
          renderItem={({ item: section }) => (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.items.length === 0 ? (
                <Text style={styles.sectionEmpty}>
                  No results matched your search
                </Text>
              ) : null}

              {section.key === "stores"
                ? section.items.map((store) => (
                    <TouchableOpacity
                      key={store.id}
                      style={styles.card}
                      onPress={() => router.push(`/customer/store/${store.id}`)}
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
                        <Text style={styles.productName}>{store.name}</Text>
                        <Text style={styles.meta}>Store result</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                : null}

              {section.key === "sellers"
                ? section.items.map((seller) => (
                    <View key={seller.id} style={styles.card}>
                      <View style={styles.iconWrap}>
                        <AppIcon
                          name="account-tie"
                          variant="community"
                          size={24}
                          color="#333"
                        />
                      </View>
                      <View style={styles.contentWrap}>
                        <Text style={styles.productName}>{seller.name}</Text>
                        <Text style={styles.meta}>Seller result</Text>
                      </View>
                    </View>
                  ))
                : null}

              {section.key === "products"
                ? section.items.map((product) =>
                    renderProductCard(product, product.id),
                  )
                : null}
            </View>
          )}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {sortedCategoryProducts.length === 0 ? (
            <Text style={styles.empty}>No products available</Text>
          ) : null}
          {sortedCategoryProducts.map((item) =>
            renderProductCard(item, item.id),
          )}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F2F2F7",
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  contentWrap: {
    flex: 1,
  },
  productCard: {
    padding: 0,
  },
  productCardMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingRight: 10,
  },
  quickAddButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
    backgroundColor: "#E8F7EC",
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
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
    marginBottom: 14,
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
  productName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  metaWrap: {
    marginTop: 4,
  },
  storeRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sellerStoreText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  arrowChip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  price: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: "600",
  },
  empty: {
    color: "#666",
    marginTop: 20,
  },
  sectionWrap: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  sectionEmpty: {
    color: "#666",
    marginBottom: 10,
  },
});
