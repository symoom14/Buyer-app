import { useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import AppIcon from "../../../src/components/AppIcon";
import EmptyFieldState from "../../../src/components/EmptyFieldState";
import { auth, db } from "../../../src/firebase/firebaseConfig";

export default function MerchantStoresManage() {
  const [stores, setStores] = useState([]);
  const router = useRouter();

  const fetchStores = async (merchantId) => {
    const storesQuery = query(
      collection(db, "stores"),
      where("merchantId", "==", merchantId),
    );
    const productsQuery = query(
      collection(db, "products"),
      where("merchantId", "==", merchantId),
    );

    const [storesSnapshot, productsSnapshot] = await Promise.all([
      getDocs(storesQuery),
      getDocs(productsQuery),
    ]);

    const productCountByStore = {};
    productsSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const id = data.storeId;
      if (!id) return;
      productCountByStore[id] = (productCountByStore[id] || 0) + 1;
    });

    const list = storesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      productCount: productCountByStore[doc.id] || 0,
    }));

    setStores(list);
  };

  useFocusEffect(
    useCallback(() => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) fetchStores(user.uid);
      });
      return unsub;
    }, []),
  );

  const handleDeleteStore = (storeId) => {
    Alert.alert(
      "Delete store?",
      "Are you sure you want to delete this store?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "stores", storeId));
            setStores((prev) => prev.filter((store) => store.id !== storeId));
          },
        },
      ],
    );
  };

  const renderRightActions = (storeId) => (
    <View style={styles.deleteActionWrap}>
      <TouchableOpacity
        style={styles.deleteCircle}
        onPress={() => handleDeleteStore(storeId)}
      >
        <AppIcon
          name="store-remove"
          variant="community"
          size={24}
          color="#C62828"
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your stores</Text>
      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          stores.length === 0 ? styles.listEmptyContainer : undefined
        }
        ListEmptyComponent={
          <EmptyFieldState message="Empty as a field. Create a new store to start selling!" />
        }
        renderItem={({ item }) => (
          <Swipeable renderRightActions={() => renderRightActions(item.id)}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/merchant/store/${item.id}`)}
            >
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                Products: {item.productCount || 0}
              </Text>
              <Text style={styles.meta}>
                Date opened:{" "}
                {item.createdAt?.toDate?.().toLocaleDateString?.() || "—"}
              </Text>
            </TouchableOpacity>
          </Swipeable>
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
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  deleteActionWrap: {
    justifyContent: "center",
    alignItems: "center",
    width: 84,
    marginBottom: 12,
  },
  deleteCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFE0E6",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  meta: {
    fontSize: 13,
    color: "#666",
    marginBottom: 2,
  },
  listEmptyContainer: {
    flexGrow: 1,
  },
});
