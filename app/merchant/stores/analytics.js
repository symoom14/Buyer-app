import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle, G, Rect, Text as SvgText } from "react-native-svg";

import AppIcon from "../../../src/components/AppIcon";
import { auth, db } from "../../../src/firebase/firebaseConfig";
import { getStatusColors } from "../../../src/theme/statusPalette";
import { useAppTheme } from "../../../src/theme/useAppTheme";

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "all", label: "All" },
];

const STATUS_ORDER = ["pending", "accepted", "completed", "cancelled"];
const DONUT_SIZE = 184;
const DONUT_THICKNESS = 26;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_THICKNESS) / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const MOSAIC_GAP = 2;

function dateInPeriod(date, periodKey) {
  if (periodKey === "all") return true;
  const now = new Date();
  const start = new Date(now);

  if (periodKey === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (periodKey === "7d") {
    start.setDate(now.getDate() - 7);
  } else if (periodKey === "30d") {
    start.setDate(now.getDate() - 30);
  }

  return date >= start && date <= now;
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function shortLabel(value, max = 12) {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function readableTextColor(backgroundColor) {
  if (!backgroundColor?.startsWith?.("#")) return "#FFFFFF";
  const hex = backgroundColor.replace("#", "");
  const fullHex =
    hex.length === 3
      ? hex
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : hex;
  if (fullHex.length !== 6) return "#FFFFFF";

  const r = parseInt(fullHex.slice(0, 2), 16);
  const g = parseInt(fullHex.slice(2, 4), 16);
  const b = parseInt(fullHex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#11181C" : "#FFFFFF";
}

export default function MerchantStoresAnalytics() {
  const params = useLocalSearchParams();
  const initialMode = params?.mode === "earnings" ? "earnings" : "store";
  const { colors, isDark } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();

  const [selectedPeriod, setSelectedPeriod] = useState("7d");
  const [mode] = useState(initialMode);
  const [loading, setLoading] = useState(true);
  const [merchantOrders, setMerchantOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [storesById, setStoresById] = useState({});

  const fetchAnalytics = async () => {
    const merchantId = auth.currentUser?.uid;
    if (!merchantId) return;

    setLoading(true);
    try {
      const [ordersSnap, productsSnap, storesSnap] = await Promise.all([
        getDocs(collection(db, "orders")),
        getDocs(
          query(
            collection(db, "products"),
            where("merchantId", "==", merchantId),
          ),
        ),
        getDocs(
          query(
            collection(db, "stores"),
            where("merchantId", "==", merchantId),
          ),
        ),
      ]);

      const localStores = {};
      storesSnap.docs.forEach((storeDoc) => {
        localStores[storeDoc.id] = storeDoc.data()?.name || "Unknown Store";
      });
      setStoresById(localStores);

      setProducts(
        productsSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })),
      );

      const orders = ordersSnap.docs
        .map((docSnap) => {
          const data = docSnap.data();
          const merchantItems = (data.items || []).filter(
            (item) => item.merchantId === merchantId,
          );
          if (!merchantItems.length) return null;

          const status =
            data.merchantStatuses?.[merchantId]?.status ||
            data.status ||
            "pending";
          const createdAt = data.createdAt?.toDate?.() || new Date(0);
          const total = merchantItems.reduce(
            (sum, item) =>
              sum + Number(item.price || 0) * Number(item.quantity || 0),
            0,
          );

          return {
            id: docSnap.id,
            status,
            createdAt,
            items: merchantItems,
            total,
          };
        })
        .filter(Boolean);

      setMerchantOrders(orders);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
    }, []),
  );

  const filteredOrders = useMemo(
    () =>
      merchantOrders.filter((order) =>
        dateInPeriod(order.createdAt, selectedPeriod),
      ),
    [merchantOrders, selectedPeriod],
  );

  const statusCounts = useMemo(() => {
    const counts = {
      pending: 0,
      accepted: 0,
      completed: 0,
      cancelled: 0,
    };
    filteredOrders.forEach((order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
    });
    return counts;
  }, [filteredOrders]);

  const totalOrders = filteredOrders.length;
  const cancelledOrders = statusCounts.cancelled || 0;
  const completedRevenue = filteredOrders
    .filter((order) => order.status === "completed")
    .reduce((sum, order) => sum + order.total, 0);
  const potentialRevenue = filteredOrders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + order.total, 0);
  const cancelRate = totalOrders ? (cancelledOrders / totalOrders) * 100 : 0;

  const topProducts = useMemo(() => {
    const byProduct = {};
    filteredOrders.forEach((order) => {
      if (order.status === "cancelled") return;
      order.items.forEach((item) => {
        const key = item.productId || item.name;
        if (!byProduct[key]) {
          byProduct[key] = {
            key,
            name: item.name || "Unknown product",
            units: 0,
            revenue: 0,
          };
        }
        byProduct[key].units += Number(item.quantity || 0);
        byProduct[key].revenue +=
          Number(item.price || 0) * Number(item.quantity || 0);
      });
    });

    return Object.values(byProduct)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [filteredOrders]);

  const productStoreById = useMemo(() => {
    const map = {};
    products.forEach((product) => {
      if (!product?.id) return;
      map[product.id] = product.storeId || "";
    });
    return map;
  }, [products]);

  const storeBreakdown = useMemo(() => {
    const byStore = {};
    filteredOrders.forEach((order) => {
      if (order.status === "cancelled") return;
      order.items.forEach((item) => {
        const fallbackStoreId =
          item.storeId || productStoreById[item.productId] || "";
        const fallbackStoreName = item.storeName || "";
        const key =
          fallbackStoreId || `fallback:${fallbackStoreName || "unknown"}`;
        if (!byStore[key]) {
          byStore[key] = {
            storeId: key,
            storeName:
              storesById[fallbackStoreId] ||
              fallbackStoreName ||
              "Unknown Store",
            revenue: 0,
            units: 0,
          };
        }
        byStore[key].revenue +=
          Number(item.price || 0) * Number(item.quantity || 0);
        byStore[key].units += Number(item.quantity || 0);
      });
    });

    return Object.values(byStore).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, productStoreById, storesById]);

  const lowStockProducts = useMemo(() => {
    const orderedByProduct = {};
    merchantOrders.forEach((order) => {
      if (order.status === "cancelled") return;
      order.items.forEach((item) => {
        if (!item.productId) return;
        orderedByProduct[item.productId] =
          (orderedByProduct[item.productId] || 0) + Number(item.quantity || 0);
      });
    });

    return products
      .map((product) => {
        const ordered = orderedByProduct[product.id] || 0;
        const qty = Number(product.quantity || 0);
        const remaining = qty - ordered;
        return {
          id: product.id,
          name: product.name || "Unnamed Product",
          remaining,
          backordered: remaining < 0,
        };
      })
      .filter((product) => product.backordered || product.remaining <= 10)
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, 8);
  }, [merchantOrders, products]);

  const screenTitle =
    mode === "earnings" ? "Earnings analytics" : "Store analytics";
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusColors = useMemo(
    () => getStatusColors(colors, isDark),
    [colors, isDark],
  );
  const donutSlices = useMemo(() => {
    const activeStatuses = STATUS_ORDER.filter(
      (status) => (statusCounts[status] || 0) > 0,
    );
    if (!activeStatuses.length || totalOrders === 0) return [];

    let cumulativeOffset = 0;
    return activeStatuses.map((status) => {
      const count = statusCounts[status] || 0;
      const ratio = count / totalOrders;
      const arcLength = ratio * DONUT_CIRCUMFERENCE;
      const slice = {
        status,
        color: statusColors[status] || statusColors.pending,
        arcLength,
        gapLength: Math.max(DONUT_CIRCUMFERENCE - arcLength, 0),
        dashOffset: -cumulativeOffset,
      };
      cumulativeOffset += arcLength;
      return slice;
    });
  }, [statusCounts, statusColors, totalOrders]);
  const topProductMosaic = useMemo(() => {
    if (potentialRevenue <= 0 || topProducts.length === 0) return [];

    const palette = [
      statusColors.completed,
      statusColors.accepted,
      statusColors.pending,
      colors.tint,
      colors.success,
      colors.warning,
      colors.danger,
      colors.pillText,
    ];

    const rows = topProducts.map((product, index) => ({
      key: product.key,
      name: product.name,
      value: Number(product.revenue || 0),
      color: palette[index % palette.length],
    }));

    const first = rows[0];
    const second = rows[1];
    const third = rows[2];
    const remainingRevenue = Math.max(
      potentialRevenue -
        Number(first?.value || 0) -
        Number(second?.value || 0) -
        Number(third?.value || 0),
      0,
    );

    const segments = [];
    if (first) segments.push({ ...first });
    if (second) segments.push({ ...second });
    if (third) segments.push({ ...third });
    if (remainingRevenue > 0.01) {
      segments.push({
        key: "__other__",
        name: "Other products",
        value: remainingRevenue,
        color: colors.textSubtle,
      });
    }

    const normalized = segments.map((item) => ({
      ...item,
      share: item.value / potentialRevenue,
    }));

    if (normalized.length === 1) {
      return {
        blocks: [
          { ...normalized[0], xPct: 0, yPct: 0, widthPct: 100, heightPct: 100 },
        ],
        legend: normalized,
      };
    }

    if (normalized.length === 2) {
      const leftWidth = normalized[0].share * 100;
      return {
        blocks: [
          {
            ...normalized[0],
            xPct: 0,
            yPct: 0,
            widthPct: leftWidth,
            heightPct: 100,
          },
          {
            ...normalized[1],
            xPct: leftWidth,
            yPct: 0,
            widthPct: 100 - leftWidth,
            heightPct: 100,
          },
        ],
        legend: normalized,
      };
    }

    const blockA = normalized[0];
    const blockB = normalized[1];
    const blockC = normalized[2];
    const blockD = normalized[3] || null;

    const bottomHeight = (blockD?.share || 0) * 100;
    const topHeight = 100 - bottomHeight;
    const topShareTotal = blockA.share + blockB.share + blockC.share;
    const rightWidth =
      topShareTotal > 0 ? (blockA.share / topShareTotal) * 100 : 50;
    const leftWidth = 100 - rightWidth;
    const leftStackTotal = blockB.share + blockC.share;
    const topLeftHeight =
      leftStackTotal > 0
        ? (blockB.share / leftStackTotal) * topHeight
        : topHeight / 2;

    const blocks = [
      {
        ...blockA,
        xPct: leftWidth,
        yPct: 0,
        widthPct: rightWidth,
        heightPct: topHeight,
      },
      {
        ...blockB,
        xPct: 0,
        yPct: 0,
        widthPct: leftWidth,
        heightPct: topLeftHeight,
      },
      {
        ...blockC,
        xPct: 0,
        yPct: topLeftHeight,
        widthPct: leftWidth,
        heightPct: topHeight - topLeftHeight,
      },
    ];

    if (blockD) {
      blocks.push({
        ...blockD,
        xPct: 0,
        yPct: topHeight,
        widthPct: 100,
        heightPct: bottomHeight,
      });
    }

    return {
      blocks,
      legend: normalized,
    };
  }, [colors, potentialRevenue, statusColors, topProducts]);
  const mosaicSize = Math.max(Math.min(windowWidth - 96, 250), 180);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{screenTitle}</Text>

      <View style={styles.filters}>
        {PERIODS.map((period) => {
          const selected = period.key === selectedPeriod;
          return (
            <TouchableOpacity
              key={period.key}
              style={[styles.filterPill, selected && styles.filterPillSelected]}
              onPress={() => setSelectedPeriod(period.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  selected && styles.filterTextSelected,
                ]}
              >
                {period.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Completed Revenue</Text>
          <Text style={styles.kpiValue}>{money(completedRevenue)}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Potential Revenue</Text>
          <Text style={styles.kpiValue}>{money(potentialRevenue)}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Orders</Text>
          <Text style={styles.kpiValue}>{totalOrders}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Cancellation Rate</Text>
          <Text style={styles.kpiValue}>{cancelRate.toFixed(1)}%</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Order Status Breakdown</Text>
      <View style={styles.statusRow}>
        {STATUS_ORDER.map((status) => (
          <View key={status} style={styles.statusChip}>
            <AppIcon
              name="circle"
              variant="community"
              size={10}
              color={statusColors[status] || statusColors.pending}
            />
            <Text style={styles.statusText}>
              {status[0].toUpperCase() + status.slice(1)}:{" "}
              {statusCounts[status] || 0}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.donutWrap}>
        {totalOrders === 0 ? (
          <View style={styles.emptyDonut}>
            <Text style={styles.emptyDonutText}>No orders in this period.</Text>
          </View>
        ) : (
          <View style={styles.donutContainer}>
            <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
              <Circle
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_RADIUS}
                stroke={colors.input}
                strokeWidth={DONUT_THICKNESS}
                fill="none"
              />
              <G
                rotation="-90"
                originX={DONUT_SIZE / 2}
                originY={DONUT_SIZE / 2}
              >
                {donutSlices.map((slice) => (
                  <Circle
                    key={slice.status}
                    cx={DONUT_SIZE / 2}
                    cy={DONUT_SIZE / 2}
                    r={DONUT_RADIUS}
                    stroke={slice.color}
                    strokeWidth={DONUT_THICKNESS}
                    fill="none"
                    strokeDasharray={`${slice.arcLength} ${slice.gapLength}`}
                    strokeDashoffset={slice.dashOffset}
                  />
                ))}
              </G>
            </Svg>
            <View pointerEvents="none" style={styles.donutCenter}>
              <Text style={styles.donutCenterValue}>{totalOrders}</Text>
              <Text style={styles.donutCenterLabel}>orders</Text>
            </View>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Top Products</Text>
      {topProducts.length === 0 ? (
        <Text style={styles.emptyText}>
          No product activity in this period.
        </Text>
      ) : (
        <>
          <View style={styles.mosaicCard}>
            <Svg width={mosaicSize} height={mosaicSize}>
              <Rect
                x={0}
                y={0}
                width={mosaicSize}
                height={mosaicSize}
                rx={10}
                ry={10}
                fill={colors.input}
              />
              {topProductMosaic.blocks?.map((block) => {
                const blockWidth = (block.widthPct / 100) * mosaicSize;
                const blockHeight = (block.heightPct / 100) * mosaicSize;
                const blockX = (block.xPct / 100) * mosaicSize;
                const blockY = (block.yPct / 100) * mosaicSize;
                const canLabel = blockWidth >= 70 && blockHeight >= 44;
                const labelColor = readableTextColor(block.color);
                return (
                  <G key={block.key}>
                    <Rect
                      x={blockX}
                      y={blockY}
                      width={blockWidth}
                      height={blockHeight}
                      fill={block.color}
                      stroke={colors.screen}
                      strokeWidth={MOSAIC_GAP}
                    />
                    {canLabel ? (
                      <>
                        <SvgText
                          x={blockX + blockWidth / 2}
                          y={blockY + blockHeight / 2 - 4}
                          fill={labelColor}
                          fontSize={11}
                          fontWeight="700"
                          textAnchor="middle"
                        >
                          {shortLabel(block.name)}
                        </SvgText>
                        <SvgText
                          x={blockX + blockWidth / 2}
                          y={blockY + blockHeight / 2 + 11}
                          fill={labelColor}
                          fontSize={10}
                          fontWeight="600"
                          textAnchor="middle"
                        >
                          {(block.share * 100).toFixed(0)}%
                        </SvgText>
                      </>
                    ) : null}
                  </G>
                );
              })}
            </Svg>
          </View>

          <View style={styles.mosaicLegend}>
            {topProductMosaic.legend?.map((block) => (
              <View key={`legend-${block.key}`} style={styles.mosaicLegendItem}>
                <View
                  style={[
                    styles.mosaicSwatch,
                    { backgroundColor: block.color },
                  ]}
                />
                <Text style={styles.mosaicLegendText} numberOfLines={1}>
                  {block.name} · {(block.share * 100).toFixed(1)}% ·{" "}
                  {money(block.value)}
                </Text>
              </View>
            ))}
          </View>

          {topProducts.map((product) => (
            <View key={product.key} style={styles.rowCard}>
              <Text style={styles.rowTitle}>{product.name}</Text>
              <Text style={styles.rowMeta}>
                {product.units} sold · {money(product.revenue)}
              </Text>
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Store Comparison</Text>
      {storeBreakdown.length === 0 ? (
        <Text style={styles.emptyText}>
          No store-level data for this period.
        </Text>
      ) : (
        storeBreakdown.map((store) => (
          <View key={store.storeId} style={styles.rowCard}>
            <Text style={styles.rowTitle}>{store.storeName}</Text>
            <Text style={styles.rowMeta}>
              {store.units} units · {money(store.revenue)}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Low Stock / Back-order Risk</Text>
      {lowStockProducts.length === 0 ? (
        <Text style={styles.emptyText}>No low-stock products right now.</Text>
      ) : (
        lowStockProducts.map((product) => (
          <View key={product.id} style={styles.rowCard}>
            <Text style={styles.rowTitle}>{product.name}</Text>
            <Text
              style={[
                styles.rowMeta,
                product.backordered ? styles.backordered : styles.lowStock,
              ]}
            >
              {product.backordered
                ? "Back-ordered"
                : `${product.remaining} left in stock`}
            </Text>
          </View>
        ))
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
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
      fontSize: 22,
      fontWeight: "700",
      marginBottom: 10,
      color: colors.text,
    },
    filters: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
      flexWrap: "wrap",
    },
    filterPill: {
      backgroundColor: colors.input,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
    },
    filterPillSelected: {
      backgroundColor: colors.text,
    },
    filterText: {
      color: colors.textMuted,
      fontWeight: "600",
      fontSize: 12,
    },
    filterTextSelected: {
      color: colors.background,
    },
    kpiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 16,
    },
    kpiCard: {
      width: "48%",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
    },
    kpiLabel: {
      fontSize: 12,
      color: colors.textSubtle,
      marginBottom: 4,
    },
    kpiValue: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 8,
      marginTop: 6,
      color: colors.text,
    },
    statusRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 10,
      height: 30,
    },
    statusText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "600",
    },
    donutWrap: {
      marginBottom: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    donutContainer: {
      width: DONUT_SIZE,
      height: DONUT_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    donutCenter: {
      width: DONUT_SIZE - DONUT_THICKNESS * 2,
      height: DONUT_SIZE - DONUT_THICKNESS * 2,
      borderRadius: (DONUT_SIZE - DONUT_THICKNESS * 2) / 2,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      position: "absolute",
    },
    donutCenterValue: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      lineHeight: 24,
    },
    donutCenterLabel: {
      fontSize: 12,
      color: colors.textSubtle,
      marginTop: 2,
    },
    emptyDonut: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    emptyDonutText: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: "500",
    },
    mosaicCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 0,
      marginBottom: 8,
      overflow: "hidden",
      alignSelf: "center",
    },
    mosaicLegend: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      marginBottom: 8,
      gap: 6,
    },
    mosaicLegendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    mosaicSwatch: {
      width: 10,
      height: 10,
      borderRadius: 2,
    },
    mosaicLegendText: {
      fontSize: 12,
      color: colors.textMuted,
      flex: 1,
    },
    rowCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 4,
      color: colors.text,
    },
    rowMeta: {
      fontSize: 13,
      color: colors.textMuted,
    },
    lowStock: {
      color: colors.warning,
      fontWeight: "600",
    },
    backordered: {
      color: colors.danger,
      fontWeight: "700",
    },
    emptyText: {
      color: colors.textSubtle,
      marginBottom: 10,
    },
  });
