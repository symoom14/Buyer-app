import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "../../../../src/components/AppIcon";
import ScreenContainer from "../../../../src/components/ScreenContainer";
import { auth, db } from "../../../../src/firebase/firebaseConfig";

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
const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const ALL_PRODUCT_ICONS = Object.keys(MaterialCommunityIcons.glyphMap || {});

export default function AddProductPage() {
  const { storeId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const fieldYRef = useRef({
    price: 0,
    quantity: 0,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [iconQuery, setIconQuery] = useState("");
  const [iconName, setIconName] = useState(DEFAULT_PRODUCT_ICON);
  const [iconModalVisible, setIconModalVisible] = useState(false);

  const normalizedQuery = iconQuery.trim().toLowerCase();
  const visibleIcons = normalizedQuery
    ? ALL_PRODUCT_ICONS.filter((icon) => icon.includes(normalizedQuery)).slice(
        0,
        48,
      )
    : [];

  const handleAddProduct = async () => {
    if (!name || !description || !price || !quantity) return;

    await addDoc(collection(db, "products"), {
      name,
      description,
      category,
      price: Number(price),
      quantity: Number(quantity),
      iconName,
      storeId,
      merchantId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });

    router.back();
  };

  const scrollToField = (fieldKey) => {
    const y = Math.max(0, (fieldYRef.current[fieldKey] ?? 0) - 24);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    }, 120);
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 12 : 0}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View>
            <Text style={styles.title}>Add Product</Text>

            <View style={styles.selectedIconRow}>
              <TouchableOpacity
                style={styles.selectedIconBubble}
                onPress={() => setIconModalVisible(true)}
              >
                <AppIcon
                  name={iconName}
                  variant="community"
                  size={28}
                  color="#222"
                />
              </TouchableOpacity>
            </View>

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

            <View
              onLayout={(event) => {
                fieldYRef.current.price = event.nativeEvent.layout.y;
              }}
            >
              <TextInput
                style={styles.input}
                placeholder="Price"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
                onFocus={() => scrollToField("price")}
              />
            </View>

            <View
              onLayout={(event) => {
                fieldYRef.current.quantity = event.nativeEvent.layout.y;
              }}
            >
              <TextInput
                style={styles.input}
                placeholder="Quantity"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
                onFocus={() => scrollToField("quantity")}
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleAddProduct}>
              <Text style={styles.buttonText}>Save Product</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={iconModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIconModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIconModalVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <TextInput
                style={styles.input}
                placeholder="Search icon (e.g. shoe, laptop, food)"
                value={iconQuery}
                onChangeText={setIconQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {normalizedQuery.length === 0 ? (
                <Text style={styles.modalHint}>
                  Icons will appear here once you start searching
                </Text>
              ) : visibleIcons.length === 0 ? (
                <Text style={styles.modalHint}>
                  Hmm..looks like there were no matches. Try searching with
                  another keyword
                </Text>
              ) : (
                <View style={styles.iconGrid}>
                  {visibleIcons.map((icon) => {
                    const isSelected = icon === iconName;
                    return (
                      <TouchableOpacity
                        key={icon}
                        style={[
                          styles.iconChip,
                          isSelected && styles.iconChipSelected,
                        ]}
                        onPress={() => setIconName(icon)}
                      >
                        <AppIcon
                          name={icon}
                          variant="community"
                          size={22}
                          color={isSelected ? "#fff" : "#333"}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
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
  selectedIconRow: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  selectedIconBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  iconChipSelected: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 5,
    padding: 14,
    minHeight: "20%",
    maxHeight: "70%",
  },
  modalHint: {
    textAlign: "center",
    color: "#777",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 20,
    marginBottom: 8,
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
