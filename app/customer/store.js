import { useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AppIcon from "../../src/components/AppIcon";
import { db } from "../../src/firebase/firebaseConfig";

export default function CustomerStores() {
  const router = useRouter();
  const [stores, setStores] = useState([]);
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
            sellerMap[doc.id] = user.username || "Unknown Seller";
          }
        });

        const list = storesSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "Unnamed Store",
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
      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No stores available</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/customer/store/${item.id}`)}
          >
            <View style={styles.iconWrap}>
              <AppIcon name="store" variant="community" size={24} color="#333" />
            </View>
            <View style={styles.contentWrap}>
              <Text style={styles.storeName}>{item.name}</Text>
              <Text style={styles.meta}>
                Seller: <Text style={styles.bold}>{item.sellerName}</Text>
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
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
    marginBottom: 16,
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
