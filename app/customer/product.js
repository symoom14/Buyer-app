import { useRouter } from "expo-router";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AppIcon from "../../src/components/AppIcon";
import { db } from "../../src/firebase/firebaseConfig";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const ICON_COLOR_POOL = [
  "#E53935", // red
  "#2E7D32", // green
  "#1E88E5", // blue
  "#FFA700", // chrome yellow
  "#F57C00", // orange
  "#111111", // black
];

export default function CustomerProducts() {
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
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

      // Fetch stores
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

      // Fetch merchants
      const userSnapshot = await getDocs(collection(db, "users"));
      const merchantMap = {};
      const merchantList = [];
      userSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.role === "merchant") {
          const sellerName = data.username || "Unknown Seller";
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
  const productResults = useMemo(() => {
    if (!isSearching) return [];
    return products.filter((product) => {
      const productName = (product.name || "").toLowerCase();
      return productName.includes(trimmedQuery);
    });
  }, [isSearching, products, trimmedQuery]);

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

      {isSearching ? (
        <FlatList
          data={[
            { key: "stores", title: "Stores", items: storeResults },
            { key: "sellers", title: "Sellers", items: sellerResults },
            { key: "products", title: "Products", items: productResults },
          ]}
          keyExtractor={(item) => item.key}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: section }) => (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.items.length === 0 ? (
                <Text style={styles.sectionEmpty}>No results matched your search</Text>
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
                ? section.items.map((product) => (
                    <TouchableOpacity
                      key={product.id}
                      style={styles.card}
                      onPress={() => router.push(`/customer/product/${product.id}`)}
                    >
                      <View style={styles.iconWrap}>
                        <AppIcon
                          name={product.iconName || DEFAULT_PRODUCT_ICON}
                          variant="community"
                          size={24}
                          color={product.iconColor || "#333"}
                        />
                      </View>

                      <View style={styles.contentWrap}>
                        <Text style={styles.productName}>{product.name}</Text>

                        <Text style={styles.meta}>
                          Store: <Text style={styles.bold}>{product.storeName}</Text>
                        </Text>

                        <Text style={styles.meta}>
                          Seller: <Text style={styles.bold}>{product.sellerName}</Text>
                        </Text>

                        <Text style={styles.price}>${product.price}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                : null}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.empty}>No products available</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/customer/product/${item.id}`)}
            >
              <View style={styles.iconWrap}>
                <AppIcon
                  name={item.iconName || DEFAULT_PRODUCT_ICON}
                  variant="community"
                  size={24}
                  color={item.iconColor || "#333"}
                />
              </View>

              <View style={styles.contentWrap}>
                <Text style={styles.productName}>{item.name}</Text>

                <Text style={styles.meta}>
                  Store: <Text style={styles.bold}>{item.storeName}</Text>
                </Text>

                <Text style={styles.meta}>
                  Seller: <Text style={styles.bold}>{item.sellerName}</Text>
                </Text>

                <Text style={styles.price}>${item.price}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
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
  productName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  meta: {
    fontSize: 14,
    color: "#555",
  },
  bold: {
    fontWeight: "500",
  },
  price: {
    marginTop: 8,
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
