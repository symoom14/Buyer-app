import { useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../../../src/firebase/firebaseConfig";

export default function MerchantStoresManage() {
  const [stores, setStores] = useState([]);
  const router = useRouter();

  const fetchStores = async (merchantId) => {
    const q = query(
      collection(db, "stores"),
      where("merchantId", "==", merchantId),
    );

    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your stores</Text>
      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No stores yet</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/merchant/store/${item.id}`)}
          >
            <Text style={styles.name}>{item.name}</Text>
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
  name: {
    fontSize: 16,
    fontWeight: "600",
  },
  empty: {
    color: "#666",
    marginTop: 12,
  },
});
