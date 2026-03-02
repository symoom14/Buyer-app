import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useHeaderHeight } from "@react-navigation/elements";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import AppIcon from "../../../../src/components/AppIcon";
import ScreenContainer from "../../../../src/components/ScreenContainer";
import { db } from "../../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../../src/theme/useAppTheme";
import { logAdminAction } from "../../../../src/utils/adminLog";
import {
  buildVariantCombinations,
  getVariantSelectionKey,
  normalizeVariantGroups,
} from "../../../../src/utils/productVariants";

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

export default function EditProductPage() {
  const { productId } = useLocalSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { colors, isDark } = useAppTheme();
  const scrollRef = useRef(null);
  const fieldYRef = useRef({
    price: 0,
    quantity: 0,
  });

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [storeCategory, setStoreCategory] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [variantGroups, setVariantGroups] = useState([]);
  const [variantPriceOverrides, setVariantPriceOverrides] = useState({});
  const [saving, setSaving] = useState(false);
  const [iconQuery, setIconQuery] = useState("");
  const [iconName, setIconName] = useState(DEFAULT_PRODUCT_ICON);
  const [iconModalVisible, setIconModalVisible] = useState(false);
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const normalizedQuery = iconQuery.trim().toLowerCase();
  const visibleIcons = normalizedQuery
    ? ALL_PRODUCT_ICONS.filter((icon) => icon.includes(normalizedQuery)).slice(
        0,
        48,
      )
    : [];
  const normalizedVariantGroups = useMemo(
    () => normalizeVariantGroups(variantGroups),
    [variantGroups],
  );
  const generatedVariants = useMemo(
    () => buildVariantCombinations(normalizedVariantGroups),
    [normalizedVariantGroups],
  );

  const fetchProduct = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, "products", productId));
      if (!snap.exists()) return;
      const data = snap.data();
      setName(data.name || "");
      setDescription(data.description || "");
      setCategory(data.category || CATEGORIES[0]);
      setPrice(data.price?.toString?.() || "");
      setQuantity(data.quantity?.toString?.() || "");
      setIconName(data.iconName || DEFAULT_PRODUCT_ICON);
      const normalizedGroups = normalizeVariantGroups(data.variantGroups || []);
      setVariantGroups(
        normalizedGroups.map((group, index) => ({
          id: String(group.id || `group_${Date.now()}_${index}`),
          name: group.name,
          options: (group.options || []).join(", "),
        })),
      );
      const variantOverridesFromProduct = Array.isArray(data.variants)
        ? data.variants.reduce((acc, variant) => {
            const key = getVariantSelectionKey(variant?.options || {});
            const override = variant?.priceOverride;
            if (
              override !== null &&
              override !== undefined &&
              override !== "" &&
              Number.isFinite(Number(override))
            ) {
              acc[key] = String(Number(override));
            }
            return acc;
          }, {})
        : {};
      setVariantPriceOverrides(variantOverridesFromProduct);

      const storeId = String(data.storeId || "").trim();
      if (!storeId) {
        setStoreCategory("");
        return;
      }

      const storeSnap = await getDoc(doc(db, "stores", storeId));
      const nextStoreCategory = String(storeSnap.data()?.category || "").trim();
      setStoreCategory(nextStoreCategory);
      if (nextStoreCategory) {
        setCategory(nextStoreCategory);
      }
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleSave = async () => {
    if (saving) return;

    const nextName = name.trim();
    const nextDescription = description.trim();
    const nextPrice = Number(price);
    const nextQuantity = Number(quantity);
    const resolvedCategory = storeCategory || category;

    if (!nextName || !nextDescription || !price || !quantity) {
      Alert.alert("Missing fields", "Please fill out all product fields.");
      return;
    }

    if (Number.isNaN(nextPrice) || Number.isNaN(nextQuantity)) {
      Alert.alert("Invalid values", "Price and quantity must be valid numbers.");
      return;
    }
    const variantsWithPricing = generatedVariants.map((variant) => {
      const key = getVariantSelectionKey(variant.options);
      const rawOverride = variantPriceOverrides[key];
      const parsedOverride = Number(rawOverride);
      return {
        ...variant,
        priceOverride:
          rawOverride === "" ||
          rawOverride === null ||
          rawOverride === undefined ||
          Number.isNaN(parsedOverride)
            ? null
            : parsedOverride,
      };
    });

    try {
      setSaving(true);
      await updateDoc(doc(db, "products", productId), {
        name: nextName,
        description: nextDescription,
        category: resolvedCategory,
        storeCategory: resolvedCategory,
        price: nextPrice,
        quantity: nextQuantity,
        iconName,
        variantGroups: normalizedVariantGroups,
        variants: variantsWithPricing,
        hasVariants: normalizedVariantGroups.length > 0,
      });
      if (pathname.startsWith("/admin/")) {
        await logAdminAction({
          action: "product_updated",
          targetType: "product",
          targetId: String(productId || ""),
          targetLabel: nextName,
          metadata: {
            category: resolvedCategory,
            storeCategory: resolvedCategory,
            price: nextPrice,
            quantity: nextQuantity,
            hasVariants: normalizedVariantGroups.length > 0,
            variantsCount: variantsWithPricing.length,
          },
        });
      }
      router.back();
    } catch (err) {
      Alert.alert("Save failed", "Couldn't save product changes. Try again.");
      console.error("Failed to save product:", err);
    } finally {
      setSaving(false);
    }
  };

  const scrollToField = (fieldKey) => {
    const y = Math.max(0, (fieldYRef.current[fieldKey] ?? 0) - 24);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    }, 120);
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
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View>
            <Text style={styles.title}>Edit Product</Text>

              <View style={styles.selectedIconRow}>
                <TouchableOpacity
                  style={styles.selectedIconBubble}
                  onPress={() => setIconModalVisible(true)}
                >
                  <AppIcon
                    name={iconName}
                    variant="community"
                    size={28}
                    color={colors.text}
                  />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Product name"
                placeholderTextColor={colors.textSubtle}
                value={name}
                onChangeText={setName}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Product description"
                placeholderTextColor={colors.textSubtle}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              {storeCategory ? (
                <TextInput
                  style={styles.input}
                  editable={false}
                  value={storeCategory}
                  placeholder="Store category"
                  placeholderTextColor={colors.textSubtle}
                />
              ) : (
                <View style={styles.pickerWrapper}>
                  <Picker selectedValue={category} onValueChange={setCategory}>
                    {CATEGORIES.map((cat) => (
                      <Picker.Item key={cat} label={cat} value={cat} />
                    ))}
                  </Picker>
                </View>
              )}

              <View
                onLayout={(event) => {
                  fieldYRef.current.price = event.nativeEvent.layout.y;
                }}
              >
                <TextInput
                  style={styles.input}
                  placeholder="Price"
                  placeholderTextColor={colors.textSubtle}
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
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                  onFocus={() => scrollToField("quantity")}
                />
              </View>

              <View style={styles.variantSection}>
                <View style={styles.variantSectionHeader}>
                  <Text style={styles.variantSectionTitle}>Variants (optional)</Text>
                  <TouchableOpacity
                    style={styles.addVariantGroupButton}
                    onPress={() =>
                      setVariantGroups((prev) => [
                        ...prev,
                        { id: `group_${Date.now()}_${prev.length}`, name: "", options: "" },
                      ])
                    }
                  >
                    <AppIcon
                      name="plus"
                      variant="community"
                      size={16}
                      color={colors.background}
                    />
                    <Text style={styles.addVariantGroupText}>Add group</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.variantHelper}>
                  Example groups: Color, Size. Options: Red, Blue or 500mL, 1L
                </Text>

                {variantGroups.map((group, index) => (
                  <View key={group.id} style={styles.variantGroupCard}>
                    <View style={styles.variantGroupHeader}>
                      <Text style={styles.variantGroupTitle}>Group {index + 1}</Text>
                      <TouchableOpacity
                        style={styles.variantRemoveButton}
                        onPress={() =>
                          setVariantGroups((prev) =>
                            prev.filter((item) => item.id !== group.id),
                          )
                        }
                      >
                        <AppIcon
                          name="close"
                          variant="community"
                          size={14}
                          color={colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={styles.input}
                      placeholder="Group name (e.g. Size)"
                      placeholderTextColor={colors.textSubtle}
                      value={group.name}
                      onChangeText={(text) =>
                        setVariantGroups((prev) =>
                          prev.map((item) =>
                            item.id === group.id ? { ...item, name: text } : item,
                          ),
                        )
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Options separated by commas"
                      placeholderTextColor={colors.textSubtle}
                      value={group.options}
                      onChangeText={(text) =>
                        setVariantGroups((prev) =>
                          prev.map((item) =>
                            item.id === group.id ? { ...item, options: text } : item,
                          ),
                        )
                      }
                    />
                  </View>
                ))}

                {generatedVariants.length > 0 ? (
                  <View style={styles.variantPreviewCard}>
                    <Text style={styles.variantPreviewTitle}>Generated combinations</Text>
                    {generatedVariants.map((variant) => {
                      const key = getVariantSelectionKey(variant.options);
                      return (
                        <View key={variant.id} style={styles.variantPreviewPriceRow}>
                          <Text style={styles.variantPreviewRow}>{variant.label}</Text>
                          <TextInput
                            style={styles.variantPriceInput}
                            placeholder={`$${Number(price || 0).toFixed(2)}`}
                            placeholderTextColor={colors.textSubtle}
                            keyboardType="decimal-pad"
                            value={variantPriceOverrides[key] ?? ""}
                            onChangeText={(text) =>
                              setVariantPriceOverrides((prev) => ({
                                ...prev,
                                [key]: text,
                              }))
                            }
                          />
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>

            <TouchableOpacity
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.buttonText}>
                {saving ? "Saving..." : "Save Changes"}
              </Text>
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
                placeholderTextColor={colors.textSubtle}
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
                          color={isSelected ? colors.background : colors.text}
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

const createStyles = (colors, isDark) =>
  StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: colors.surface,
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
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
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
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  iconChipSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.28)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 5,
    padding: 14,
    minHeight: "20%",
    maxHeight: "70%",
  },
  modalHint: {
    textAlign: "center",
    color: colors.textSubtle,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  button: {
    backgroundColor: colors.text,
    padding: 14,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.background,
    fontWeight: "600",
  },
  variantSection: {
    marginTop: 8,
    marginBottom: 6,
  },
  variantSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8,
  },
  variantSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  addVariantGroupButton: {
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.text,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  addVariantGroupText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "600",
  },
  variantHelper: {
    color: colors.textSubtle,
    fontSize: 12,
    marginBottom: 8,
  },
  variantGroupCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  variantGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  variantGroupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  variantRemoveButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  variantPreviewCard: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.surface,
  },
  variantPreviewTitle: {
    fontSize: 12,
    color: colors.textSubtle,
    marginBottom: 4,
  },
  variantPreviewRow: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 2,
  },
  variantPreviewPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  variantPriceInput: {
    width: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlign: "right",
  },
});
