import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import ScreenContainer from "../../../../src/components/ScreenContainer";
import { db } from "../../../../src/firebase/firebaseConfig";

const CATEGORIES = [
  "Personal",
  "Tech",
  "Lifestyle",
  "Home",
  "Pets",
  "Vehicles",
  "Kids",
  "Clothing",
  "Food",
];

export default function EditProductPage() {
  const { productId } = useLocalSearchParams();
  const router = useRouter();
  const headerHeight = useHeaderHeight();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");

  useEffect(() => {
    fetchProduct();
  }, []);

  const fetchProduct = async () => {
    try {
      const snap = await getDoc(doc(db, "products", productId));
      if (!snap.exists()) return;
      const data = snap.data();
      setName(data.name || "");
      setDescription(data.description || "");
      setCategory(data.category || CATEGORIES[0]);
      setPrice(data.price?.toString?.() || "");
      setQuantity(data.quantity?.toString?.() || "");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name || !description || !price || !quantity) return;

    await updateDoc(doc(db, "products", productId), {
      name,
      description,
      category,
      price: Number(price),
      quantity: Number(quantity),
    });

    router.back();
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size="large" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight + 12}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View>
            <Text style={styles.title}>Edit Product</Text>

            <TextInput
              style={styles.input}
              placeholder="Product name"
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Product description"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <View style={styles.pickerWrapper}>
              <Picker selectedValue={category} onValueChange={setCategory}>
                {CATEGORIES.map((cat) => (
                  <Picker.Item key={cat} label={cat} value={cat} />
                ))}
              </Picker>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Price"
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
            />

            <TextInput
              style={styles.input}
              placeholder="Quantity"
              keyboardType="numeric"
              value={quantity}
              onChangeText={setQuantity}
            />

            <TouchableOpacity style={styles.button} onPress={handleSave}>
              <Text style={styles.buttonText}>Save Changes</Text>
            </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
  },
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
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    marginBottom: 8,
    overflow: "hidden",
  },
  button: {
    backgroundColor: "#000",
    padding: 14,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
