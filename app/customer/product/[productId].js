import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "../../../src/components/AppIcon";
import ScreenContainer from "../../../src/components/ScreenContainer";
import { getSelectedVariantIconColor } from "../../../src/constants/variantColorMap";
import { useCart } from "../../../src/context/CartContext";
import { useFavorites } from "../../../src/context/FavoritesContext";
import { auth, db } from "../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../src/theme/useAppTheme";
import {
  findMatchingVariant,
  formatSelectedOptionsLabel,
  getCartItemKey,
  normalizeVariantGroups,
  resolveSelectedOptions,
  resolveVariantUnitPrice,
} from "../../../src/utils/productVariants";
import { getUserDisplayName } from "../../../src/utils/userDisplayName";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const FAVORITE_ICON_SIZE = 21;
const FAVORITE_ICON_WRAP_SIZE = FAVORITE_ICON_SIZE + 8;
const PRODUCT_ACTIONS_HEIGHT = 96;
const ICON_COLOR_POOL = [
  "#E53935", // red
  "#2E7D32", // green
  "#1E88E5", // blue
  "#FFA700", // chrome yellow
  "#F57C00", // orange
];

function getReviewUsername(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Customer";
  const beforeAt = raw.includes("@") ? raw.split("@")[0] : raw;
  const firstWord = beforeAt.trim().split(/\s+/)[0] || "";
  return firstWord || "Customer";
}

function getStarIconName(ratingValue, starPosition) {
  const rating = Number(ratingValue || 0);
  if (rating >= starPosition) return "star";
  if (rating >= starPosition - 0.5) return "star-half-full";
  return "star-outline";
}

function formatReviewTimeAgo(dateValue) {
  if (!dateValue || typeof dateValue.getTime !== "function") return "";
  const elapsedMs = Date.now() - dateValue.getTime();
  const minutes = Math.max(1, Math.floor(elapsedMs / (1000 * 60)));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export default function ProductDetails() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const productId = Array.isArray(params.productId)
    ? params.productId[0]
    : params.productId;

  const { cart, addToCart } = useCart();
  const { hasFavorite, toggleFavorite } = useFavorites();

  const [product, setProduct] = useState(null);
  const [store, setStore] = useState(null);
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [hasOrderedProduct, setHasOrderedProduct] = useState(false);
  const [purchaseCheckLoading, setPurchaseCheckLoading] = useState(true);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSelectedOptions, setReviewSelectedOptions] = useState({});
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewsSectionY, setReviewsSectionY] = useState(0);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef(null);
  const favoriteAnim = useRef(new Animated.Value(0)).current;
  const isFavorite = hasFavorite(productId);
  const iconColor = useMemo(() => {
    const idx = Math.floor(Math.random() * ICON_COLOR_POOL.length);
    return ICON_COLOR_POOL[idx];
  }, []);

  useEffect(() => {
    Animated.timing(favoriteAnim, {
      toValue: isFavorite ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [favoriteAnim, isFavorite]);

  const fetchData = useCallback(async () => {
    const productSnap = await getDoc(doc(db, "products", productId));
    if (!productSnap.exists()) return;

    const productData = productSnap.data();
    setProduct(productData);

    const storeSnap = await getDoc(doc(db, "stores", productData.storeId));
    if (storeSnap.exists()) {
      const storeData = storeSnap.data();
      setStore(storeData);

      const merchantSnap = await getDoc(doc(db, "users", storeData.merchantId));
      if (merchantSnap.exists()) {
        setMerchant(merchantSnap.data());
      }
    }

    setLoading(false);
  }, [productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchReviews = useCallback(async () => {
    const targetProductId = String(productId || "");
    if (!targetProductId) {
      setReviews([]);
      setReviewsLoading(false);
      return;
    }

    setReviewsLoading(true);
    try {
      const reviewsSnap = await getDocs(
        query(
          collection(db, "productReviews"),
          where("productId", "==", targetProductId),
        ),
      );

      const nextReviews = reviewsSnap.docs
        .map((reviewDoc) => {
          const data = reviewDoc.data() || {};
          const createdAtDate = data.createdAt?.toDate?.() || null;
          const updatedAtDate = data.updatedAt?.toDate?.() || null;
          return {
            id: reviewDoc.id,
            ...data,
            rating: Number(data.rating || 0),
            reviewedOptions:
              data.reviewedOptions && typeof data.reviewedOptions === "object"
                ? data.reviewedOptions
                : {},
            reviewedOptionsLabel: String(
              data.reviewedOptionsLabel || "",
            ).trim(),
            createdAtDate,
            updatedAtDate,
          };
        })
        .filter((review) => review.rating >= 1 && review.rating <= 5)
        .sort((a, b) => {
          const aTime =
            a.updatedAtDate?.getTime?.() || a.createdAtDate?.getTime?.() || 0;
          const bTime =
            b.updatedAtDate?.getTime?.() || b.createdAtDate?.getTime?.() || 0;
          return bTime - aTime;
        });

      setReviews(nextReviews);
    } catch (error) {
      console.error("Failed to fetch product reviews:", error);
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const checkPurchaseEligibility = useCallback(async () => {
    const customerId = auth.currentUser?.uid;
    const targetProductId = String(productId || "");
    if (!customerId || !targetProductId) {
      setHasOrderedProduct(false);
      setPurchaseCheckLoading(false);
      return;
    }

    setPurchaseCheckLoading(true);
    try {
      const ordersSnap = await getDocs(
        query(collection(db, "orders"), where("customerId", "==", customerId)),
      );
      const didOrder = ordersSnap.docs.some((orderDoc) => {
        const data = orderDoc.data() || {};
        return (data.items || []).some(
          (item) => String(item.productId || "") === targetProductId,
        );
      });
      setHasOrderedProduct(didOrder);
    } catch (error) {
      console.error("Failed to check review eligibility:", error);
      setHasOrderedProduct(false);
    } finally {
      setPurchaseCheckLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    checkPurchaseEligibility();
  }, [checkPurchaseEligibility]);

  const variantGroups = useMemo(
    () => normalizeVariantGroups(product?.variantGroups),
    [product?.variantGroups],
  );

  useEffect(() => {
    if (!variantGroups.length) {
      setSelectedOptions({});
      return;
    }
    setSelectedOptions((prev) => resolveSelectedOptions(prev, variantGroups));
  }, [variantGroups]);

  const variantLabel = useMemo(
    () => formatSelectedOptionsLabel(selectedOptions, variantGroups),
    [selectedOptions, variantGroups],
  );
  const resolvedUnitPrice = useMemo(
    () =>
      resolveVariantUnitPrice(
        product?.price || 0,
        product?.variants,
        selectedOptions,
      ),
    [product?.price, product?.variants, selectedOptions],
  );
  const selectedVariantIconColor = useMemo(
    () => getSelectedVariantIconColor(selectedOptions),
    [selectedOptions],
  );
  const cartItemKey = useMemo(
    () => getCartItemKey(productId, selectedOptions),
    [productId, selectedOptions],
  );

  const handleAddToCart = () => {
    const resolvedOptions = resolveSelectedOptions(
      selectedOptions,
      variantGroups.length ? variantGroups : product?.variantGroups,
    );
    const matchedVariant = findMatchingVariant(
      product?.variants,
      resolvedOptions,
    );
    addToCart({
      productId,
      cartItemKey: getCartItemKey(productId, resolvedOptions),
      name: product.name,
      price: resolvedUnitPrice,
      quantity: 1,
      iconName: product.iconName || DEFAULT_PRODUCT_ICON,
      storeId: product.storeId,
      storeName: store?.name || "Unknown store",
      merchantId: store?.merchantId || "unknown",
      merchantName: getUserDisplayName(merchant, "Unknown merchant"),
      selectedVariantId: matchedVariant?.id || null,
      selectedOptions: resolvedOptions,
      selectedOptionsLabel: formatSelectedOptionsLabel(
        resolvedOptions,
        variantGroups.length ? variantGroups : product?.variantGroups,
      ),
    });
  };

  const handleFavoritePress = () => {
    toggleFavorite(productId);
  };
  const handleQuickBuy = () => {
    router.push({
      pathname: "/customer/quick-checkout/[productId]",
      params: {
        productId,
        selectedOptions:
          variantGroups.length > 0
            ? JSON.stringify(
                resolveSelectedOptions(selectedOptions, variantGroups),
              )
            : "",
      },
    });
  };
  const sellerName = getUserDisplayName(merchant, "Unknown");
  const isInCart = cart.some(
    (item) =>
      item.cartItemKey === cartItemKey ||
      (!item.cartItemKey && item.productId === productId),
  );
  const handlePrimaryCartAction = () => {
    if (isInCart) {
      router.push("/customer/cart");
      return;
    }
    handleAddToCart();
  };
  const currentUserId = auth.currentUser?.uid || "";
  const ownReview = useMemo(
    () => reviews.find((review) => review.customerId === currentUserId) || null,
    [currentUserId, reviews],
  );
  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    const total = reviews.reduce(
      (sum, review) => sum + Number(review.rating || 0),
      0,
    );
    return total / reviews.length;
  }, [reviews]);

  const openReviewModal = () => {
    if (!hasOrderedProduct || purchaseCheckLoading) return;
    if (ownReview) {
      setReviewRating(Math.max(1, Math.min(5, Number(ownReview.rating || 5))));
      setReviewComment(String(ownReview.comment || ""));
      setReviewSelectedOptions(
        resolveSelectedOptions(ownReview.reviewedOptions, variantGroups),
      );
    } else {
      setReviewRating(0);
      setReviewComment("");
      setReviewSelectedOptions(
        resolveSelectedOptions(selectedOptions, variantGroups),
      );
    }
    setReviewModalVisible(true);
  };

  const reviewOptionsLabel = useMemo(
    () => formatSelectedOptionsLabel(reviewSelectedOptions, variantGroups),
    [reviewSelectedOptions, variantGroups],
  );

  const handleSubmitReview = async () => {
    if (!currentUserId || submittingReview || !product || !hasOrderedProduct)
      return;
    if (Number(reviewRating || 0) <= 0) {
      Alert.alert(
        "Rating required",
        "Please select a star rating before submitting.",
      );
      return;
    }
    const targetProductId = String(productId || "");
    if (!targetProductId) return;
    const merchantId = String(
      store?.merchantId || product?.merchantId || "",
    ).trim();
    const reviewId = `${targetProductId}_${currentUserId}`;
    const sanitizedRating = Math.max(1, Math.min(5, Number(reviewRating || 5)));
    const comment = String(reviewComment || "").trim();
    const selectedReviewOptions = resolveSelectedOptions(
      reviewSelectedOptions,
      variantGroups,
    );
    const selectedReviewOptionsLabel = formatSelectedOptionsLabel(
      selectedReviewOptions,
      variantGroups,
    );

    try {
      setSubmittingReview(true);
      const reviewRef = doc(db, "productReviews", reviewId);
      const existingSnap = await getDoc(reviewRef);
      await setDoc(
        reviewRef,
        {
          productId: targetProductId,
          merchantId,
          customerId: currentUserId,
          customerName:
            auth.currentUser?.displayName ||
            auth.currentUser?.email ||
            "Customer",
          rating: sanitizedRating,
          comment,
          reviewedOptions: selectedReviewOptions,
          reviewedOptionsLabel: selectedReviewOptionsLabel,
          updatedAt: serverTimestamp(),
          ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      );

      setReviewModalVisible(false);
      await fetchReviews();
    } catch (error) {
      console.error("Failed to submit review:", error);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!ownReview || !currentUserId || submittingReview) return;

    Alert.alert(
      "Delete review",
      "Are you sure you want to delete your review?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setSubmittingReview(true);
              await deleteDoc(doc(db, "productReviews", ownReview.id));
              setReviewModalVisible(false);
              await fetchReviews();
            } catch (error) {
              console.error("Failed to delete review:", error);
            } finally {
              setSubmittingReview(false);
            }
          },
        },
      ],
    );
  };

  const handleJumpToReviews = () => {
    scrollRef.current?.scrollTo?.({
      y: Math.max(Number(reviewsSectionY || 0) - 8, 0),
      animated: true,
    });
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size="large" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer disableBottomInset bottomPadding={0}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + PRODUCT_ACTIONS_HEIGHT },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaPillsRow}>
          <TouchableOpacity
            style={styles.metaPill}
            onPress={() => {
              if (!store?.merchantId) return;
              router.push(`/customer/seller/${store.merchantId}`);
            }}
          >
            <AppIcon
              name="account-tie"
              variant="community"
              size={13}
              color={colors.textMuted}
            />
            <Text numberOfLines={1} style={styles.metaPillText}>
              {sellerName}
            </Text>
          </TouchableOpacity>
          <View style={styles.metaArrowChip}>
            <AppIcon
              name="chevron-right"
              variant="community"
              size={14}
              color={colors.textMuted}
            />
          </View>
          <TouchableOpacity
            style={styles.metaPill}
            onPress={() => router.push(`/customer/store/${product.storeId}`)}
          >
            <AppIcon
              name="store"
              variant="community"
              size={13}
              color={colors.textMuted}
            />
            <Text numberOfLines={1} style={styles.metaPillText}>
              {store?.name || "Unknown"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.metaSecondaryRow}>
          <TouchableOpacity
            style={styles.ratingPill}
            onPress={handleJumpToReviews}
            activeOpacity={0.85}
          >
            <AppIcon
              name={reviews.length ? "star" : "star-settings-outline"}
              variant="community"
              size={13}
              color="#F4B400"
            />
            <Text style={styles.ratingPillText}>
              {reviews.length
                ? `${averageRating.toFixed(1)} (${reviews.length})`
                : "0"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.iconWrap}>
          <AppIcon
            name={product.iconName || DEFAULT_PRODUCT_ICON}
            variant="community"
            size={98}
            color={selectedVariantIconColor || iconColor}
          />
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>{product.name}</Text>

          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={handleFavoritePress}
            activeOpacity={0.85}
          >
            <View style={styles.favoriteIconWrap}>
              <Animated.View
                style={[
                  styles.favoriteIconLayer,
                  {
                    opacity: favoriteAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0],
                    }),
                    transform: [
                      {
                        scale: favoriteAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0.9],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <AppIcon
                  name="heart-outline"
                  variant="community"
                  size={FAVORITE_ICON_SIZE}
                  color={colors.text}
                />
              </Animated.View>

              <Animated.View
                style={[
                  styles.favoriteIconLayer,
                  {
                    opacity: favoriteAnim,
                    transform: [
                      {
                        scale: favoriteAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.9, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <AppIcon
                  name="heart"
                  variant="community"
                  size={FAVORITE_ICON_SIZE}
                  color="#D32F2F"
                />
              </Animated.View>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.price}>
          ${Number(resolvedUnitPrice || 0).toFixed(2)}
        </Text>
        {variantGroups.length > 0 ? (
          <View style={styles.variantsSection}>
            {variantGroups.map((group) => (
              <View key={group.id} style={styles.variantGroup}>
                <Text style={styles.variantGroupTitle}>{group.name}</Text>
                <View style={styles.variantOptionsRow}>
                  {group.options.map((option) => {
                    const selected = selectedOptions[group.name] === option;
                    return (
                      <TouchableOpacity
                        key={`${group.id}-${option}`}
                        style={[
                          styles.variantOptionChip,
                          selected && styles.variantOptionChipActive,
                        ]}
                        onPress={() =>
                          setSelectedOptions((prev) => ({
                            ...prev,
                            [group.name]: option,
                          }))
                        }
                      >
                        <Text
                          style={[
                            styles.variantOptionText,
                            selected && styles.variantOptionTextActive,
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            {variantLabel ? (
              <Text style={styles.variantSummaryText}>
                Selected: {variantLabel}
              </Text>
            ) : null}
          </View>
        ) : null}

        {product.description ? (
          <Text style={styles.description}>{product.description}</Text>
        ) : null}

        <View
          style={styles.reviewsSection}
          onLayout={(event) => setReviewsSectionY(event.nativeEvent.layout.y)}
        >
          <View style={styles.reviewsHeaderRow}>
            <View style={styles.reviewsHeaderMeta}>
              <Text style={styles.reviewsTitle}>Reviews</Text>
              <View style={styles.reviewsStatsRow}>
                <View style={styles.reviewStarsInline}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <AppIcon
                      key={`avg-star-${value}`}
                      name={getStarIconName(averageRating, value)}
                      variant="community"
                      size={14}
                      color="#F4B400"
                    />
                  ))}
                </View>
                <Text style={styles.reviewsSummaryText}>
                  {reviews.length
                    ? `${averageRating.toFixed(1)} (${reviews.length})`
                    : "No reviews yet"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.addReviewButton,
                (!hasOrderedProduct || purchaseCheckLoading) &&
                  styles.addReviewButtonDisabled,
              ]}
              onPress={openReviewModal}
              disabled={!hasOrderedProduct || purchaseCheckLoading}
            >
              <Text style={styles.addReviewText}>
                {ownReview ? "Edit review" : "Add review"}
              </Text>
            </TouchableOpacity>
          </View>
          {!purchaseCheckLoading && !hasOrderedProduct ? (
            <Text style={styles.reviewEligibilityText}>
              You can add a review after ordering this product.
            </Text>
          ) : null}

          {reviewsLoading ? (
            <ActivityIndicator size="small" />
          ) : reviews.length === 0 ? (
            <Text style={styles.reviewsEmptyText}>
              Be the first to review this product.
            </Text>
          ) : (
            reviews.map((review, index) => (
              <View
                key={review.id}
                style={[
                  styles.reviewRow,
                  index < reviews.length - 1 && styles.reviewRowDivider,
                ]}
              >
                <View style={styles.reviewTopRow}>
                  <View style={styles.reviewUserMeta}>
                    <Text style={styles.reviewUserText}>
                      {review.customerId === currentUserId
                        ? "You"
                        : getReviewUsername(review.customerName)}
                    </Text>
                    <Text style={styles.reviewTimeText}>
                      {formatReviewTimeAgo(
                        review.updatedAtDate || review.createdAtDate,
                      )}
                    </Text>
                  </View>
                  <View style={styles.reviewStarsInline}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <AppIcon
                        key={`${review.id}-star-${value}`}
                        name={getStarIconName(review.rating, value)}
                        variant="community"
                        size={13}
                        color="#F4B400"
                      />
                    ))}
                  </View>
                </View>
                {review.reviewedOptionsLabel ? (
                  <Text style={styles.reviewOptionsMeta} numberOfLines={1}>
                    Bought: {review.reviewedOptionsLabel}
                  </Text>
                ) : formatSelectedOptionsLabel(
                    review.reviewedOptions,
                    variantGroups,
                  ) ? (
                  <Text style={styles.reviewOptionsMeta} numberOfLines={1}>
                    Bought:{" "}
                    {formatSelectedOptionsLabel(
                      review.reviewedOptions,
                      variantGroups,
                    )}
                  </Text>
                ) : null}
                {review.comment ? (
                  <Text style={styles.reviewCommentText}>{review.comment}</Text>
                ) : (
                  <Text style={styles.reviewCommentMuted}>
                    No written feedback.
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.reviewModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setReviewModalVisible(false)}
          />
          <View style={styles.reviewModalCard}>
            <Text style={styles.reviewModalTitle}>
              {ownReview ? "Update review" : "Add review"}
            </Text>
            <Text style={styles.reviewModalMeta}>Rate this product</Text>
            <View style={styles.reviewModalStarsRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <TouchableOpacity
                  key={`modal-star-${value}`}
                  style={styles.reviewStarButton}
                  onPress={() => setReviewRating(value)}
                >
                  <AppIcon
                    name={getStarIconName(reviewRating, value)}
                    variant="community"
                    size={26}
                    color="#F4B400"
                  />
                </TouchableOpacity>
              ))}
            </View>
            {variantGroups.length > 0 ? (
              <View style={styles.reviewOptionsSection}>
                <Text style={styles.reviewOptionsTitle}>What did you buy?</Text>
                {variantGroups.map((group) => (
                  <View
                    key={`review-${group.id}`}
                    style={styles.reviewOptionGroup}
                  >
                    <Text style={styles.reviewOptionGroupLabel}>
                      {group.name}
                    </Text>
                    <View style={styles.reviewOptionChipsRow}>
                      {group.options.map((option) => {
                        const selected =
                          reviewSelectedOptions[group.name] === option;
                        return (
                          <TouchableOpacity
                            key={`review-${group.id}-${option}`}
                            style={[
                              styles.reviewOptionChip,
                              selected && styles.reviewOptionChipActive,
                            ]}
                            onPress={() =>
                              setReviewSelectedOptions((prev) => ({
                                ...prev,
                                [group.name]: option,
                              }))
                            }
                          >
                            <Text
                              style={[
                                styles.reviewOptionChipText,
                                selected && styles.reviewOptionChipTextActive,
                              ]}
                            >
                              {option}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
                {reviewOptionsLabel ? (
                  <Text style={styles.reviewOptionsSummary} numberOfLines={1}>
                    Selected: {reviewOptionsLabel}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <TextInput
              style={styles.reviewInput}
              multiline
              maxLength={280}
              placeholder="Write your feedback (optional)"
              placeholderTextColor={colors.textSubtle}
              value={reviewComment}
              onChangeText={setReviewComment}
            />
            <View style={styles.reviewModalActions}>
              {ownReview ? (
                <TouchableOpacity
                  style={styles.reviewDeleteButton}
                  onPress={handleDeleteReview}
                  disabled={submittingReview}
                >
                  <Text style={styles.reviewDeleteText}>Delete review</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.reviewCancelButton}
                onPress={() => setReviewModalVisible(false)}
              >
                <Text style={styles.reviewCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.reviewSubmitButton,
                  (submittingReview || Number(reviewRating || 0) <= 0) &&
                    styles.reviewSubmitButtonDisabled,
                ]}
                onPress={handleSubmitReview}
                disabled={submittingReview || Number(reviewRating || 0) <= 0}
              >
                <Text style={styles.reviewSubmitText}>
                  {submittingReview ? "Saving..." : "Save review"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.actionsFooter, { paddingBottom: 12 }]}>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, isInCart && styles.goToCartButton]}
            onPress={handlePrimaryCartAction}
          >
            <AppIcon
              name={isInCart ? "basket" : "basket-plus"}
              variant="community"
              size={19}
              color={isInCart ? styles.goToCartText.color : colors.text}
            />
            <Text
              style={[
                styles.secondaryButtonText,
                isInCart && styles.goToCartText,
              ]}
            >
              {isInCart ? "Go to cart" : "Add to Cart"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleQuickBuy}>
            <AppIcon
              name="credit-card-fast-outline"
              variant="community"
              size={19}
              color={colors.background}
            />
            <Text style={styles.buttonText}>Quick buy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      paddingBottom: 12,
    },
    metaPillsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 6,
    },
    metaSecondaryRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    metaArrowChip: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.screen,
      alignItems: "center",
      justifyContent: "center",
    },
    metaPill: {
      maxWidth: "72%",
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
    },
    metaPillText: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.textMuted,
      maxWidth: 180,
    },
    ratingPill: {
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    ratingPillText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: "600",
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
      gap: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
    },
    iconWrap: {
      marginTop: 40,
      marginBottom: 50,
      alignItems: "center",
      justifyContent: "center",
    },
    price: {
      fontSize: 22,
      fontWeight: "700",
      textAlign: "left",
      marginBottom: 12,
      color: colors.text,
    },
    button: {
      backgroundColor: colors.text,
      height: 48,
      flex: 1,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    buttonText: {
      color: colors.background,
      fontWeight: "600",
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      height: 48,
      flex: 1,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: "600",
    },
    goToCartButton: {
      backgroundColor: colors.successSoft,
      borderWidth: 0,
    },
    goToCartText: {
      color: colors.success,
    },
    favoriteButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    favoriteIconWrap: {
      width: FAVORITE_ICON_WRAP_SIZE,
      height: FAVORITE_ICON_WRAP_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    favoriteIconLayer: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
    },
    description: {
      marginTop: 14,
      marginBottom: 20,
      fontSize: 15,
      lineHeight: 21,
    },
    reviewsSection: {
      marginTop: 30,
      marginBottom: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
    },
    reviewsHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 8,
    },
    reviewsHeaderMeta: {
      flex: 1,
    },
    reviewsTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
    },
    reviewsStatsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    reviewsSummaryText: {
      fontSize: 12,
      color: colors.textSubtle,
      fontWeight: "600",
    },
    addReviewButton: {
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.text,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    addReviewButtonDisabled: {
      opacity: 0.45,
    },
    addReviewText: {
      color: colors.background,
      fontWeight: "600",
      fontSize: 12,
    },
    reviewEligibilityText: {
      fontSize: 12,
      color: colors.textSubtle,
      marginBottom: 8,
    },
    reviewsEmptyText: {
      fontSize: 13,
      color: colors.textSubtle,
    },
    reviewRow: {
      paddingVertical: 8,
    },
    reviewRowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    reviewTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
      gap: 8,
    },
    reviewUserMeta: {
      flexDirection: "column",
      gap: 1,
      flex: 1,
      minWidth: 0,
    },
    reviewUserText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    reviewTimeText: {
      fontSize: 11,
      color: colors.textSubtle,
      fontWeight: "500",
    },
    reviewStarsInline: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    reviewCommentText: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
    reviewOptionsMeta: {
      fontSize: 11,
      color: colors.textSubtle,
      marginBottom: 4,
    },
    reviewCommentMuted: {
      fontSize: 12,
      color: colors.textSubtle,
      fontStyle: "italic",
    },
    reviewModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.34)",
      justifyContent: "center",
      padding: 18,
    },
    reviewModalCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    reviewModalTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    reviewModalMeta: {
      fontSize: 12,
      color: colors.textSubtle,
      marginBottom: 8,
    },
    reviewModalStarsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    reviewStarButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    reviewOptionsSection: {
      marginBottom: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderRadius: 10,
      backgroundColor: colors.background,
      gap: 6,
    },
    reviewOptionsTitle: {
      fontSize: 12,
      color: colors.textSubtle,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    reviewOptionGroup: {
      gap: 5,
    },
    reviewOptionGroupLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "600",
    },
    reviewOptionChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    reviewOptionChip: {
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    reviewOptionChipActive: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    reviewOptionChipText: {
      fontSize: 12,
      color: colors.text,
      fontWeight: "500",
    },
    reviewOptionChipTextActive: {
      color: colors.background,
      fontWeight: "700",
    },
    reviewOptionsSummary: {
      fontSize: 11,
      color: colors.textSubtle,
    },
    reviewInput: {
      minHeight: 90,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 10,
      color: colors.text,
      backgroundColor: colors.background,
      textAlignVertical: "top",
      marginBottom: 12,
    },
    reviewModalActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
    },
    reviewCancelButton: {
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    reviewCancelText: {
      fontSize: 12,
      color: colors.text,
      fontWeight: "600",
    },
    reviewDeleteButton: {
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      marginRight: "auto",
    },
    reviewDeleteText: {
      fontSize: 12,
      color: colors.danger,
      fontWeight: "700",
    },
    reviewSubmitButton: {
      height: 34,
      borderRadius: 17,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.text,
    },
    reviewSubmitButtonDisabled: {
      opacity: 0.7,
    },
    reviewSubmitText: {
      fontSize: 12,
      color: colors.background,
      fontWeight: "700",
    },
    variantsSection: {
      marginTop: 8,
      marginBottom: 8,
      gap: 8,
    },
    variantGroup: {
      gap: 6,
    },
    variantGroupTitle: {
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.3,
      color: colors.textSubtle,
      fontWeight: "700",
    },
    variantOptionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    variantOptionChip: {
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    variantOptionChipActive: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    variantOptionText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "500",
    },
    variantOptionTextActive: {
      color: colors.background,
      fontWeight: "600",
    },
    variantSummaryText: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textMuted,
    },
    actionsFooter: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
      backgroundColor: colors.background,
      paddingTop: 10,
      paddingHorizontal: 16,
    },
    actionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
  });
