import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../../src/firebase/firebaseConfig";

const STORE_CATEGORIES = [
  "Electronics",
  "Home",
  "Pets",
  "Beauty",
  "Fashion",
  "Sports",
  "Groceries",
  "Other",
];

export default function MerchantStoresAdd() {
  const [storeName, setStoreName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const router = useRouter();

  const handleCreateStore = async () => {
    if (!storeName.trim()) return;
    if (!selectedCategory) {
      Alert.alert("Category required", "Please choose a store category.");
      return;
    }

    await addDoc(collection(db, "stores"), {
      name: storeName,
      category: selectedCategory,
      merchantId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });

    setStoreName("");
    setSelectedCategory("");
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
      <Text style={styles.label}>Store category</Text>
      <View style={styles.categoryWrap}>
        {STORE_CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category;
          return (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryPill,
                isSelected ? styles.categoryPillSelected : null,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  isSelected ? styles.categoryPillTextSelected : null,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  categoryPill: {
    backgroundColor: "#EAF1FF",
    borderWidth: 1,
    borderColor: "#C9D9FF",
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 32,
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
