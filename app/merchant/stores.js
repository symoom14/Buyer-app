import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import LogoutButton from "../../src/components/LogoutButton";
import ScreenContainer from "../../src/components/ScreenContainer";
import { auth, db } from "../../src/firebase/firebaseConfig";

export default function MerchantStoresScreen() {
  const [storeName, setStoreName] = useState("");
  const [stores, setStores] = useState([]);
  const router = useRouter();

  const fetchStores = async () => {
    const q = query(
      collection(db, "stores"),
      where("merchantId", "==", auth.currentUser.uid),
    );

    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setStores(list);
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleCreateStore = async () => {
    if (!storeName.trim()) return;

    await addDoc(collection(db, "stores"), {
      name: storeName,
      merchantId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });

    setStoreName("");
    fetchStores();
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>My Stores</Text>

      <TextInput
        style={styles.input}
        placeholder="New store name"
        value={storeName}
        onChangeText={setStoreName}
      />

      <TouchableOpacity style={styles.button} onPress={handleCreateStore}>
        <Text style={styles.buttonText}>Open Store</Text>
      </TouchableOpacity>

      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No stores yet</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.storeCard}
            onPress={() => router.push(`/merchant/store/${item.id}`)}
          >
            <Text style={styles.storeName}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      <LogoutButton />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  button: {
    backgroundColor: "#000",
    padding: 14,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#fff",
  },
  storeCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    marginBottom: 12,
  },
  storeName: {
    fontSize: 16,
    fontWeight: "600",
  },
  empty: {
    color: "#666",
    marginTop: 12,
  },
});
