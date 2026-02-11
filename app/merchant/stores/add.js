import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { auth, db } from "../../../src/firebase/firebaseConfig";

export default function MerchantStoresAdd() {
  const [storeName, setStoreName] = useState("");
  const router = useRouter();

  const handleCreateStore = async () => {
    if (!storeName.trim()) return;

    await addDoc(collection(db, "stores"), {
      name: storeName,
      merchantId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });

    setStoreName("");
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add new store</Text>
      <TextInput
        style={styles.input}
        placeholder="New store name"
        value={storeName}
        onChangeText={setStoreName}
      />
      <TouchableOpacity style={styles.button} onPress={handleCreateStore}>
        <Text style={styles.buttonText}>Open Store</Text>
      </TouchableOpacity>
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
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    backgroundColor: "#fff",
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
    fontWeight: "600",
  },
});
