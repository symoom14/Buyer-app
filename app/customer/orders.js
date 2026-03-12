import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";

import AppIcon from "../../src/components/AppIcon";
import EmptyFieldState from "../../src/components/EmptyFieldState";
import QuickCheckoutButton from "../../src/components/QuickCheckoutButton";
import { useCart } from "../../src/context/CartContext";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";
import { getStatusColors } from "../../src/theme/statusPalette";
import { getUserDisplayName } from "../../src/utils/userDisplayName";

const DEFAULT_PRODUCT_ICON = "package-variant-closed";
const ICON_COLOR_POOL = [
  "#E53935",
  "#2E7D32",
  "#1E88E5",
  "#FFA700",
  "#F57C00",
];

const STATUS_ICONS = {
  pending: "receipt-clock",
  accepted: "receipt-text-arrow-right",
  completed: "receipt-text-check",
  cancelled: "close-box",
};

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  completed: "Completed",
  cancelled: "Cancelled",
};
const ESTIMATED_DELIVERY_OPTIONS = [
  "Today",
  "Tomorrow",
  "In a week",
  "In two weeks",
];

function toHexChannel(value) {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, "0");
}

function withAlpha(hexColor, alpha = 0.14) {
  if (typeof hexColor !== "string" || !hexColor.startsWith("#")) return null;
  if (hexColor.length !== 7) return null;
  return `${hexColor}${toHexChannel(alpha * 255)}`;
}

function getLightIconBackground(iconColor, fallbackColor) {
  if (typeof iconColor !== "string" || !iconColor.startsWith("#")) {
    return fallbackColor;
  }

  const compactHex = iconColor.slice(1);
  const fullHex =
    compactHex.length === 3
      ? compactHex
          .split("")
          .map((ch) => `${ch}${ch}`)
          .join("")
      : compactHex;

  if (fullHex.length !== 6) return fallbackColor;

  const r = parseInt(fullHex.slice(0, 2), 16);
  const g = parseInt(fullHex.slice(2, 4), 16);
  const b = parseInt(fullHex.slice(4, 6), 16);

  if ([r, g, b].every((channel) => channel <= 30)) {
    return "#E5E7EB";
  }

  const mix = 0.78;
  const bgR = r + (255 - r) * mix;
  const bgG = g + (255 - g) * mix;
  const bgB = b + (255 - b) * mix;

  return `#${toHexChannel(bgR)}${toHexChannel(bgG)}${toHexChannel(bgB)}`;
}

function formatOrderTime(createdAt) {
  const rawDate = createdAt?.toDate?.();
  if (!rawDate) return "—";
  return rawDate.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function startOfDay(dateInput) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(dateInput) {
  const date = startOfDay(dateInput);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return date;
}

function formatSectionDate(dateInput) {
  return new Date(dateInput).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function pickPaletteColor(seedValue) {
  const raw = String(seedValue || "");
  if (!raw) return ICON_COLOR_POOL[0];
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % ICON_COLOR_POOL.length;
  return ICON_COLOR_POOL[idx];
}

function getEstimatedDelivery(seedValue) {
  const raw = String(seedValue || "");
  if (!raw) return ESTIMATED_DELIVERY_OPTIONS[0];
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % ESTIMATED_DELIVERY_OPTIONS.length;
  return ESTIMATED_DELIVERY_OPTIONS[idx];
}

export default function CustomerOrders() {
  const [orders, setOrders] = useState([]);
  const router = useRouter();
  const { addToCart } = useCart();
  const { colors, isDark } = useAppTheme();
  const [expandedId, setExpandedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchFocused, setSearchFocused] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusColors = useMemo(
    () => getStatusColors(colors, isDark),
    [colors, isDark],
  );
  const chipStatusColors = useMemo(
    () => ({
      ...statusColors,
      accepted: isDark ? "#4DA3FF" : statusColors.accepted,
    }),
    [isDark, statusColors],
  );

  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const fetchOrders = async (customerId) => {
    const [snapshot, usersSnapshot, productsSnapshot] = await Promise.all([
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "users")),
      getDocs(collection(db, "products")),
    ]);
    const merchantNameById = {};
    const productVisualById = {};

    usersSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      merchantNameById[docSnap.id] = getUserDisplayName(data, "Unknown seller");
    });
    productsSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      productVisualById[String(docSnap.id)] = {
        iconName: data?.iconName || data?.icon || DEFAULT_PRODUCT_ICON,
        iconColor: data?.iconColor || null,
      };
    });

    const grouped = snapshot.docs.flatMap((docSnap) => {
      const data = docSnap.data();
      if (data.customerId !== customerId) return [];

      const itemsByMerchant = {};

      (data.items || []).forEach((item) => {
        if (!itemsByMerchant[item.merchantId]) {
          itemsByMerchant[item.merchantId] = [];
        }
        itemsByMerchant[item.merchantId].push(item);
      });

      return Object.entries(itemsByMerchant).map(([merchantId, items]) => {
        const enrichedItems = (items || []).map((item) => {
          const visual = productVisualById[String(item.productId)] || {};
          const seededColor = pickPaletteColor(item.productId || item.name);
          return {
            ...item,
            iconName: item.iconName || item.icon || visual.iconName || DEFAULT_PRODUCT_ICON,
            iconColor: seededColor,
          };
        });
        const names = items.map((i) => i.name).filter(Boolean);
        const primary = names[0];
        const extra = names.length - 1;

        return {
          id: `${docSnap.id}:${merchantId}`,
          orderId: docSnap.id,
          merchantId,
          merchantName:
            merchantNameById[merchantId] ||
            items[0]?.merchantName ||
            items[0]?.sellerName ||
            items[0]?.storeName ||
            "Unknown seller",
          createdAt: data.createdAt,
          total: enrichedItems.reduce((s, i) => s + i.quantity * i.price, 0),
          status: data.merchantStatuses?.[merchantId]?.status || "pending",
          itemSummary:
            extra > 0 ? `${primary} +${extra} more` : primary || "Order",
          items: enrichedItems,
        };
      });
    });

    setOrders(
      grouped.sort(
        (a, b) => b.createdAt?.toMillis?.() - a.createdAt?.toMillis?.(),
      ),
    );
  };

  useFocusEffect(
    useCallback(() => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) fetchOrders(user.uid);
      });
      return unsub;
    }, []),
  );

  const visibleOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filteredByStatus =
      selectedStatus === "all"
        ? orders
        : orders.filter((o) => o.status === selectedStatus);

    if (!q) return filteredByStatus;

    return filteredByStatus.filter((order) => {
      const merchant = (order.merchantName || "").toLowerCase();
      const itemNames = (order.items || [])
        .map((item) => (item?.name || "").toLowerCase())
        .join(" ");
      return merchant.includes(q) || itemNames.includes(q);
    });
  }, [orders, searchQuery, selectedStatus]);

  const groupedOrderRows = useMemo(() => {
    if (visibleOrders.length === 0) return [];

    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekStart = startOfWeek(now);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const buckets = {
      today: [],
      yesterday: [],
      thisWeek: [],
      lastWeek: [],
    };
    const olderByDate = new Map();
    const unknownDateOrders = [];

    visibleOrders.forEach((order) => {
      const rawDate = order.createdAt?.toDate?.();
      if (!rawDate) {
        unknownDateOrders.push(order);
        return;
      }

      const orderDayStart = startOfDay(rawDate);
      if (orderDayStart.getTime() === todayStart.getTime()) {
        buckets.today.push(order);
        return;
      }
      if (orderDayStart.getTime() === yesterdayStart.getTime()) {
        buckets.yesterday.push(order);
        return;
      }
      if (orderDayStart >= weekStart) {
        buckets.thisWeek.push(order);
        return;
      }
      if (orderDayStart >= lastWeekStart && orderDayStart < weekStart) {
        buckets.lastWeek.push(order);
        return;
      }

      const dateKey = orderDayStart.toISOString().slice(0, 10);
      if (!olderByDate.has(dateKey)) {
        olderByDate.set(dateKey, {
          key: dateKey,
          title: formatSectionDate(orderDayStart),
          items: [],
        });
      }
      olderByDate.get(dateKey).items.push(order);
    });

    const rows = [];
    const pushSection = (title, key, items) => {
      if (!items.length) return;
      rows.push({ type: "header", key: `header:${key}`, title });
      items.forEach((order) =>
        rows.push({ type: "order", key: `order:${order.id}`, order }),
      );
    };

    pushSection("Today", "today", buckets.today);
    pushSection("Yesterday", "yesterday", buckets.yesterday);
    pushSection("This week", "this-week", buckets.thisWeek);
    pushSection("Last week", "last-week", buckets.lastWeek);

    Array.from(olderByDate.values())
      .sort((a, b) => b.key.localeCompare(a.key))
      .forEach((section) => {
        pushSection(section.title, section.key, section.items);
      });

    pushSection("Unknown date", "unknown-date", unknownDateOrders);
    return rows;
  }, [visibleOrders]);

  const isOnboardingEmpty =
    orders.length === 0 &&
    !searchQuery.trim() &&
    selectedStatus === "all";
  const hasAnyOrders = orders.length > 0;

  const statusFilters = [
    {
      key: "all",
      label: "All",
      light: "#E5E5EA",
      dark: "#6E6E73",
    },
    {
      key: "pending",
      label: "Pending",
      light: "#FFF4CC",
      dark: "#B38300",
    },
    {
      key: "accepted",
      label: "Accepted",
      light: "#DDEEFF",
      dark: "#0B5ED7",
    },
    {
      key: "completed",
      label: "Completed",
      light: "#DFF7E6",
      dark: "#1E8E3E",
    },
    {
      key: "cancelled",
      label: "Cancelled",
      light: "#FFE0E0",
      dark: "#C62828",
    },
  ];

  const handleReorder = useCallback(
    (order) => {
      (order.items || []).forEach((item) => {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        for (let i = 0; i < quantity; i += 1) {
          addToCart({
            productId: item.productId,
            name: item.name,
            price: Number(item.price) || 0,
            quantity: 1,
            storeId: item.storeId,
            storeName: item.storeName || "Unknown Store",
            merchantId: item.merchantId || order.merchantId,
            merchantName: item.merchantName || order.merchantName || "Unknown Seller",
            iconName: item.iconName || DEFAULT_PRODUCT_ICON,
            iconColor: item.iconColor || null,
            selectedVariantId: item.selectedVariantId || null,
            selectedOptions: item.selectedOptions || {},
            selectedOptionsLabel: item.selectedOptionsLabel || "",
          });
        }
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push("/customer/cart");
    },
    [addToCart, router],
  );

  return (
    <View style={styles.container}>
      {hasAnyOrders && (
        <>
          <View style={styles.searchWrap}>
            <AppIcon
              variant="community"
              name="magnify"
              color={colors.textSubtle}
              size={18}
            />
            <TextInput
              placeholder="Search by merchant or product"
              placeholderTextColor={colors.textSubtle}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.search}
              clearButtonMode="while-editing"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </View>
          <View style={styles.filters}>
            {statusFilters.map((filter) => {
              const isSelected = selectedStatus === filter.key;
              const isInactive = searchFocused;
              return (
                <Pressable
                  key={filter.key}
                  style={[
                    styles.filterPill,
                    isInactive && styles.filterInactive,
                    !isInactive &&
                      !isSelected && {
                        backgroundColor: filter.light,
                        borderColor: "transparent",
                      },
                    !isInactive &&
                      isSelected && {
                        backgroundColor: filter.dark,
                        borderColor: filter.light,
                      },
                  ]}
                  onPress={() => setSelectedStatus(filter.key)}
                  disabled={isInactive}
                >
                  <Text
                    style={[
                      styles.filterText,
                      isInactive && styles.filterTextInactive,
                      !isInactive && !isSelected && { color: filter.dark },
                      !isInactive && isSelected && { color: colors.background },
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      <FlatList
        data={groupedOrderRows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={[
          styles.listContent,
          groupedOrderRows.length === 0 ? styles.listEmptyContainer : undefined,
        ]}
        ListEmptyComponent={
          isOnboardingEmpty ? (
            <EmptyFieldState message="Empty as a field. Browse some stores to start buying!" />
          ) : (
            <Text style={styles.empty}>No orders found</Text>
          )
        }
        renderItem={({ item: row }) => {
          if (row.type === "header") {
            return <Text style={styles.sectionHeader}>{row.title}</Text>;
          }

          const item = row.order;
          const isExpanded = expandedId === item.id;
          const previewItems = item.items?.slice(0, 3) || [];
          const extraCount = (item.items?.length || 0) - previewItems.length;
          const primaryItem = item.items?.[0];
          const iconColor =
            primaryItem?.iconColor || (isDark ? colors.text : "#333333");
          const iconName =
            primaryItem?.iconName || primaryItem?.icon || DEFAULT_PRODUCT_ICON;
          const showEstimatedDelivery =
            item.status === "pending" || item.status === "accepted";
          const deliveryPrefix =
            item.status === "accepted"
              ? "Shipped. Estimated delivery:"
              : "Estimated delivery:";
          const estimatedDelivery = getEstimatedDelivery(item.id);
          return (
            <View>
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() =>
                  router.push(
                    `/customer/orders/${item.orderId}?merchantId=${item.merchantId}`,
                  )
                }
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  setExpandedId((prev) => (prev === item.id ? null : item.id));
                }}
              >
                <View style={styles.cardLeft}>
                  <View
                    style={[
                      styles.orderIconWrap,
                      {
                        backgroundColor: getLightIconBackground(
                          iconColor,
                          colors.input,
                        ),
                      },
                    ]}
                  >
                    <AppIcon
                      variant="community"
                      name={iconName}
                      color={iconColor}
                      size={20}
                    />
                  </View>
                  <View style={styles.cardMain}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.sub} numberOfLines={1}>
                        {item.merchantName}
                      </Text>
                      <Text style={styles.meta}>{formatOrderTime(item.createdAt)}</Text>
                    </View>
                    <Text style={styles.title} numberOfLines={1}>
                      {item.itemSummary}
                    </Text>
                    <View style={styles.cardBottomRow}>
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor:
                              withAlpha(
                                chipStatusColors[item.status] || chipStatusColors.pending,
                              ) || colors.input,
                          },
                        ]}
                      >
                        <AppIcon
                          variant="community"
                          name={STATUS_ICONS[item.status]}
                          color={chipStatusColors[item.status] || chipStatusColors.pending}
                          size={14}
                        />
                        <Text
                          style={[
                            styles.statusText,
                            {
                              color:
                                chipStatusColors[item.status] || chipStatusColors.pending,
                            },
                          ]}
                        >
                          {STATUS_LABELS[item.status] || STATUS_LABELS.pending}
                        </Text>
                      </View>
                    </View>
                    {showEstimatedDelivery && (
                      <Text style={styles.estimatedDeliveryText}>
                        <Text style={styles.estimatedDeliveryPrefix}>
                          {deliveryPrefix}{" "}
                        </Text>
                        {estimatedDelivery}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.right}>
                  <Text style={styles.priceLabel}>Total</Text>
                  <Text style={styles.price}>${item.total.toFixed(2)}</Text>
                  <View style={styles.reorderAction}>
                    <QuickCheckoutButton
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        handleReorder(item);
                      }}
                      buttonStyle={styles.reorderButton}
                      iconColor="#1B5E20"
                    />
                  </View>
                </View>
              </Pressable>

              {isExpanded && (
                <View style={styles.preview}>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Status</Text>
                    <Text style={styles.previewValue}>
                      {(item.status || "pending").toUpperCase()}
                    </Text>
                  </View>
                  {previewItems.map((p, idx) => (
                    <Text
                      key={`${item.id}-p-${idx}`}
                      style={styles.previewItem}
                    >
                      {p.name} × {p.quantity}
                    </Text>
                  ))}
                  {extraCount > 0 && (
                    <Text style={styles.previewMore}>
                      +{extraCount} more item{extraCount > 1 ? "s" : ""}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        }}
      />
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
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.input,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 0,
    marginTop: 5,
    marginBottom: 7,
  },
  filterInactive: {
    backgroundColor: colors.input,
    borderColor: "transparent",
  },
  filterText: {
    fontSize: 11,
    fontWeight: "600",
  },
  filterTextInactive: {
    color: colors.textSubtle,
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginRight: 8,
  },
  orderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  cardMain: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 3 },
  sub: { flex: 1, fontSize: 12, color: colors.textSubtle, fontWeight: "600" },
  meta: { fontSize: 11, color: colors.textSubtle },
  cardBottomRow: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  estimatedDeliveryText: {
    marginTop: 6,
    fontSize: 11,
    color: colors.textSubtle,
  },
  estimatedDeliveryPrefix: {
    color: colors.text,
    fontWeight: "700",
  },
  right: { alignItems: "flex-end", justifyContent: "center", gap: 2 },
  priceLabel: {
    fontSize: 11,
    color: colors.textSubtle,
    fontWeight: "600",
  },
  price: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 1 },
  reorderAction: {
    marginTop: 6,
    alignItems: "center",
  },
  reorderButton: {
    borderRadius: 999,
    backgroundColor: "#DDF5E6",
    borderWidth: 0,
  },
  preview: {
    marginTop: -6,
    marginBottom: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  previewLabel: {
    fontSize: 12,
    color: colors.textSubtle,
    fontWeight: "600",
  },
  previewValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "600",
  },
  previewItem: {
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
  },
  previewMore: {
    fontSize: 12,
    color: colors.textSubtle,
    marginTop: 4,
  },
  empty: {
    textAlign: "center",
    color: colors.textSubtle,
    marginTop: 40,
  },
  listEmptyContainer: {
    flexGrow: 1,
  },
  listContent: {
    paddingBottom: 18,
  },
});
