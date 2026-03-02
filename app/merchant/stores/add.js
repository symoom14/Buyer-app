import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useMemo, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../src/theme/useAppTheme";

const STORE_CATEGORIES = [
  "Electronics",
  "Home",
  "Pets",
  "Beauty",
  "Fashion",
  "Sports",
  "Groceries",
  "Appliances",
  "Other",
];

export default function MerchantStoresAdd() {
  const [storeName, setStoreName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
        placeholderTextColor={colors.textSubtle}
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

const createStyles = (colors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.screen,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 8,
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  categoryPill: {
    backgroundColor: colors.pill,
    borderWidth: 1,
    borderColor: colors.pillBorder,
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 32,
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
  button: {
    backgroundColor: colors.text,
    padding: 14,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: colors.background,
    fontWeight: "600",
  },
});
