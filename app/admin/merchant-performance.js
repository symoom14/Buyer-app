import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { collection, onSnapshot } from "firebase/firestore";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AppIcon from "../../src/components/AppIcon";
import PdfViewer from "../../src/components/PdfViewer";
import ScreenContainer from "../../src/components/ScreenContainer";
import { db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";

const normalizeRole = (value) => String(value || "").trim().toLowerCase();
const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "all", label: "All" },
];
const SORT_METRICS = [
  { key: "revenue", label: "Revenue" },
  { key: "completedRate", label: "Completed %" },
  { key: "cancelRate", label: "Cancelled %" },
  { key: "orders", label: "Orders" },
  { key: "products", label: "Products" },
  { key: "oldestPendingAgeMs", label: "Oldest pending" },
];
const SORT_DIRECTIONS = [
  { key: "desc", label: "High -> Low" },
  { key: "asc", label: "Low -> High" },
];

const dateInPeriod = (date, periodKey) => {
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
};

const toCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatOrderTotal = (orderData) => {
  const directTotal = Number(orderData.totalAmount ?? orderData.total ?? 0);
  if (directTotal > 0) return directTotal;
  const items = Array.isArray(orderData.items) ? orderData.items : [];
  return items.reduce(
    (sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );
};

const formatAgeCompact = (ageMs) => {
  if (!Number.isFinite(ageMs) || ageMs < 0) return "—";
  if (ageMs >= DAY_MS) return `${Math.floor(ageMs / DAY_MS)}d`;
  const hourMs = 60 * 60 * 1000;
  if (ageMs >= hourMs) return `${Math.floor(ageMs / hourMs)}h`;
  const minuteMs = 60 * 1000;
  return `${Math.max(1, Math.floor(ageMs / minuteMs))}m`;
};

const formatDateTime = (date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export default function AdminMerchantPerformanceScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("7d");
  const [selectedSortMetric, setSelectedSortMetric] = useState("revenue");
  const [selectedSortDirection, setSelectedSortDirection] = useState("desc");
  const [openSortMenu, setOpenSortMenu] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState("");
  const [buildingPdf, setBuildingPdf] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const merchantRows = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((user) => normalizeRole(user.role) === "merchant");
      setMerchants(merchantRows);
    });

    const unsubStores = onSnapshot(collection(db, "stores"), (snap) => {
      setStores(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })),
      );
    });

    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      setProducts(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })),
      );
    });

    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
      setOrders(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })),
      );
    });

    return () => {
      unsubUsers();
      unsubStores();
      unsubProducts();
      unsubOrders();
    };
  }, []);

  const merchantRows = useMemo(() => {
    const storesByMerchant = stores.reduce((acc, store) => {
      const merchantId = store.merchantId;
      if (!merchantId) return acc;
      acc[merchantId] = (acc[merchantId] || 0) + 1;
      return acc;
    }, {});

    const productsByMerchant = products.reduce((acc, product) => {
      const merchantId = product.merchantId;
      if (!merchantId) return acc;
      acc[merchantId] = (acc[merchantId] || 0) + 1;
      return acc;
    }, {});

    const revenueByMerchant = {};
    const pendingPotentialByMerchant = {};
    const ordersByMerchant = {};
    const completedByMerchant = {};
    const cancelledByMerchant = {};
    const oldestPendingAgeByMerchant = {};

    orders.forEach((order) => {
      const orderTotal = formatOrderTotal(order);
      const createdAt = order.createdAt?.toDate?.() || null;
      if (!createdAt || !dateInPeriod(createdAt, selectedPeriod)) return;
      const status = order.status || "pending";
      const ageMs = createdAt ? Date.now() - createdAt.getTime() : null;
      const seenMerchantIds = new Set();

      (order.items || []).forEach((item) => {
        const merchantId = item.merchantId;
        if (!merchantId) return;

        if (status === "accepted" || status === "completed") {
          const lineTotal = Number(item.price || 0) * Number(item.quantity || 0);
          revenueByMerchant[merchantId] = (revenueByMerchant[merchantId] || 0) + lineTotal;
        } else if (status === "pending") {
          const lineTotal = Number(item.price || 0) * Number(item.quantity || 0);
          pendingPotentialByMerchant[merchantId] =
            (pendingPotentialByMerchant[merchantId] || 0) + lineTotal;
        }

        if (!seenMerchantIds.has(merchantId)) {
          ordersByMerchant[merchantId] = (ordersByMerchant[merchantId] || 0) + 1;
          if (status === "completed") {
            completedByMerchant[merchantId] = (completedByMerchant[merchantId] || 0) + 1;
          }
          if (status === "cancelled") {
            cancelledByMerchant[merchantId] = (cancelledByMerchant[merchantId] || 0) + 1;
          }
          if (status === "pending" && Number.isFinite(ageMs)) {
            oldestPendingAgeByMerchant[merchantId] = Math.max(
              oldestPendingAgeByMerchant[merchantId] || 0,
              ageMs,
            );
          }
          seenMerchantIds.add(merchantId);
        }
      });

      if ((order.items || []).length === 0 && order.merchantId) {
        const merchantId = order.merchantId;
        if (status === "accepted" || status === "completed") {
          revenueByMerchant[merchantId] = (revenueByMerchant[merchantId] || 0) + orderTotal;
        } else if (status === "pending") {
          pendingPotentialByMerchant[merchantId] =
            (pendingPotentialByMerchant[merchantId] || 0) + orderTotal;
        }
        ordersByMerchant[merchantId] = (ordersByMerchant[merchantId] || 0) + 1;
        if (status === "completed") {
          completedByMerchant[merchantId] = (completedByMerchant[merchantId] || 0) + 1;
        }
        if (status === "cancelled") {
          cancelledByMerchant[merchantId] = (cancelledByMerchant[merchantId] || 0) + 1;
        }
        if (status === "pending" && Number.isFinite(ageMs)) {
          oldestPendingAgeByMerchant[merchantId] = Math.max(
            oldestPendingAgeByMerchant[merchantId] || 0,
            ageMs,
          );
        }
      }
    });

    return merchants
      .map((merchant) => {
        const merchantId = merchant.id;
        const ordersCount = ordersByMerchant[merchantId] || 0;
        const cancelled = cancelledByMerchant[merchantId] || 0;

        return {
          id: merchantId,
          name: merchant.name || merchant.username || "Unnamed merchant",
          username: merchant.username || "",
          revenue: revenueByMerchant[merchantId] || 0,
          pendingPotential: pendingPotentialByMerchant[merchantId] || 0,
          orders: ordersCount,
          completed: completedByMerchant[merchantId] || 0,
          cancelled,
          stores: storesByMerchant[merchantId] || 0,
          products: productsByMerchant[merchantId] || 0,
          completedRate: ordersCount > 0 ? ((completedByMerchant[merchantId] || 0) / ordersCount) * 100 : 0,
          cancelRate: ordersCount > 0 ? (cancelled / ordersCount) * 100 : 0,
          oldestPendingAgeMs: oldestPendingAgeByMerchant[merchantId] ?? null,
        };
      });
  }, [merchants, stores, products, orders, selectedPeriod]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return merchantRows;

    return merchantRows.filter((row) => {
      return (
        row.name.toLowerCase().includes(q) ||
        row.username.toLowerCase().includes(q)
      );
    });
  }, [merchantRows, searchQuery]);

  const visibleRows = useMemo(() => {
    const rows = [...filteredRows];
    const directionMultiplier = selectedSortDirection === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const aValue = Number(a[selectedSortMetric] ?? 0);
      const bValue = Number(b[selectedSortMetric] ?? 0);
      return (aValue - bValue) * directionMultiplier;
    });
    return rows;
  }, [filteredRows, selectedSortMetric, selectedSortDirection]);

  const totalRevenue = useMemo(
    () => visibleRows.reduce((sum, row) => sum + row.revenue, 0),
    [visibleRows],
  );
  const totalPendingPotential = useMemo(
    () => visibleRows.reduce((sum, row) => sum + Number(row.pendingPotential || 0), 0),
    [visibleRows],
  );
  const selectedPeriodScope = useMemo(
    () => PERIODS.find((period) => period.key === selectedPeriod)?.label || "7D",
    [selectedPeriod],
  );
  const selectedSortMetricLabel = useMemo(
    () => SORT_METRICS.find((metric) => metric.key === selectedSortMetric)?.label || "Revenue",
    [selectedSortMetric],
  );
  const selectedSortDirectionLabel = useMemo(
    () => SORT_DIRECTIONS.find((direction) => direction.key === selectedSortDirection)?.label || "Highest to lowest",
    [selectedSortDirection],
  );

  const buildReportHtml = useCallback(() => {
    const generatedAt = formatDateTime(new Date());
    const merchantRowsHtml =
      visibleRows.length > 0
        ? visibleRows
            .map((row) => {
              const oldestPending =
                row.oldestPendingAgeMs == null ? "—" : `${formatAgeCompact(row.oldestPendingAgeMs)} old`;
              return `
                <tr>
                  <td>${escapeHtml(row.name)}</td>
                  <td>@${escapeHtml(row.username || "unknown")}</td>
                  <td>${escapeHtml(toCurrency(row.revenue))}</td>
                  <td>${row.orders}</td>
                  <td>${row.completed} (${row.completedRate.toFixed(0)}%)</td>
                  <td>${row.cancelled} (${row.cancelRate.toFixed(0)}%)</td>
                  <td>${row.products}</td>
                  <td>${row.stores}</td>
                  <td>${escapeHtml(oldestPending)}</td>
                </tr>
              `;
            })
            .join("")
        : `<tr><td colspan="9">No merchants found for current filters.</td></tr>`;

    return `
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; color: #111; }
            h1 { margin: 0 0 4px 0; font-size: 26px; }
            h2 { margin: 0 0 18px 0; font-size: 20px; }
            .meta { margin-bottom: 14px; }
            .meta p { margin: 4px 0; font-size: 13px; }
            .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
            .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
            .kpi-label { font-size: 12px; color: #555; margin-bottom: 3px; }
            .kpi-value { font-size: 20px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
            th { background-color: #f7f7f7; }
          </style>
        </head>
        <body>
          <h1>Buyer</h1>
          <h2>Admin Merchant Performance Report</h2>
          <div class="meta">
            <p><b>Generated:</b> ${escapeHtml(generatedAt)}</p>
            <p><b>Period:</b> ${escapeHtml(selectedPeriodScope)}</p>
            <p><b>Search scope:</b> ${escapeHtml(searchQuery.trim() || "All merchants")}</p>
            <p><b>Sort:</b> ${escapeHtml(selectedSortMetricLabel)} (${escapeHtml(selectedSortDirectionLabel)})</p>
          </div>
          <div class="kpis">
            <div class="kpi">
              <div class="kpi-label">Visible Merchant Revenue</div>
              <div class="kpi-value">${escapeHtml(toCurrency(totalRevenue))}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Merchants in View</div>
              <div class="kpi-value">${visibleRows.length}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Username</th>
                <th>Revenue</th>
                <th>Orders</th>
                <th>Completed</th>
                <th>Cancelled</th>
                <th>Products</th>
                <th>Stores</th>
                <th>Oldest Pending</th>
              </tr>
            </thead>
            <tbody>${merchantRowsHtml}</tbody>
          </table>
        </body>
      </html>
    `;
  }, [
    searchQuery,
    selectedPeriodScope,
    selectedSortDirectionLabel,
    selectedSortMetricLabel,
    totalRevenue,
    visibleRows,
  ]);

  const handlePreviewReport = useCallback(async () => {
    try {
      setBuildingPdf(true);
      const html = buildReportHtml();
      const { uri } = await Print.printToFileAsync({ html });
      setPreviewUri(uri);
      setViewerVisible(true);
    } catch (error) {
      console.error("Failed to generate admin merchant performance PDF preview:", error);
    } finally {
      setBuildingPdf(false);
    }
  }, [buildReportHtml]);

  const handleShareReport = useCallback(async () => {
    try {
      setSharingPdf(true);
      const html = buildReportHtml();
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (error) {
      console.error("Failed to share admin merchant performance PDF:", error);
    } finally {
      setSharingPdf(false);
    }
  }, [buildReportHtml]);

  return (
    <ScreenContainer disableBottomInset bottomPadding={12}>
      <View style={styles.pageContent}>
      <PdfViewer
        visible={viewerVisible}
        uri={previewUri}
        onClose={() => setViewerVisible(false)}
      />

      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search merchant by name or username"
        placeholderTextColor={colors.textSubtle}
        style={styles.searchInput}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        onFocus={() => setOpenSortMenu(null)}
      />
      <View style={styles.filtersRow}>
        <View style={styles.filters}>
          {PERIODS.map((period) => {
            const selected = period.key === selectedPeriod;
            return (
              <TouchableOpacity
                key={period.key}
                style={[styles.filterPill, selected && styles.filterPillSelected]}
                onPress={() => {
                  setOpenSortMenu(null);
                  setSelectedPeriod(period.key);
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.reportActions}>
          <TouchableOpacity
            style={[styles.actionIconBtn, buildingPdf && styles.previewBtnDisabled]}
            onPress={handlePreviewReport}
            disabled={buildingPdf || sharingPdf}
            activeOpacity={0.85}
          >
            <AppIcon
              name="chart-box-outline"
              variant="community"
              size={18}
              color={colors.background}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shareBtn, sharingPdf && styles.previewBtnDisabled]}
            onPress={handleShareReport}
            disabled={sharingPdf || buildingPdf}
            activeOpacity={0.85}
          >
            <AppIcon
              name="printer-outline"
              variant="community"
              size={18}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.sortRow}>
        <View style={styles.sortDropdownWrap}>
          <TouchableOpacity
            style={styles.sortTrigger}
            activeOpacity={0.85}
            onPress={() =>
              setOpenSortMenu((prev) => (prev === "metric" ? null : "metric"))
            }
          >
            <Text style={styles.sortTriggerText} numberOfLines={1}>
              {selectedSortMetricLabel}
            </Text>
            <AppIcon
              name={openSortMenu === "metric" ? "chevron-up" : "chevron-down"}
              variant="community"
              size={16}
              color={colors.textSubtle}
            />
          </TouchableOpacity>
          {openSortMenu === "metric" ? (
            <View style={styles.sortMenu}>
              {SORT_METRICS.map((metric) => (
                <TouchableOpacity
                  key={metric.key}
                  style={styles.sortMenuItem}
                  activeOpacity={0.85}
                  onPress={() => {
                    setSelectedSortMetric(metric.key);
                    setOpenSortMenu(null);
                  }}
                >
                  <Text
                    style={[
                      styles.sortMenuItemText,
                      metric.key === selectedSortMetric && styles.sortMenuItemTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {metric.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.sortDropdownWrap}>
          <TouchableOpacity
            style={styles.sortTrigger}
            activeOpacity={0.85}
            onPress={() =>
              setOpenSortMenu((prev) => (prev === "direction" ? null : "direction"))
            }
          >
            <Text style={styles.sortTriggerText} numberOfLines={1}>
              {selectedSortDirectionLabel}
            </Text>
            <AppIcon
              name={openSortMenu === "direction" ? "chevron-up" : "chevron-down"}
              variant="community"
              size={16}
              color={colors.textSubtle}
            />
          </TouchableOpacity>
          {openSortMenu === "direction" ? (
            <View style={styles.sortMenu}>
              {SORT_DIRECTIONS.map((direction) => (
                <TouchableOpacity
                  key={direction.key}
                  style={styles.sortMenuItem}
                  activeOpacity={0.85}
                  onPress={() => {
                    setSelectedSortDirection(direction.key);
                    setOpenSortMenu(null);
                  }}
                >
                  <Text
                    style={[
                      styles.sortMenuItemText,
                      direction.key === selectedSortDirection && styles.sortMenuItemTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {direction.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>
          Visible Merchant Revenue ({selectedPeriodScope})
        </Text>
        <View style={styles.summaryValueRow}>
          <Text style={styles.summaryValue}>{toCurrency(totalRevenue)}</Text>
          {totalPendingPotential > 0 ? (
            <Text style={styles.summaryPendingPotential}>
              + {toCurrency(totalPendingPotential)}
            </Text>
          ) : null}
        </View>
        <Text style={styles.summaryMeta}>
          Sum of displayed merchants based on current period, search and sort. Merchants: {visibleRows.length}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setOpenSortMenu(null)}
      >
        {visibleRows.length === 0 ? (
          <Text style={styles.emptyText}>No merchants found.</Text>
        ) : null}

        {visibleRows.map((row) => (
          <View key={row.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.name}>{row.name}</Text>
                <Text style={styles.username}>@{row.username || "unknown"}</Text>
              </View>
              <View style={styles.revenueWrap}>
                <View style={styles.revenuePill}>
                  <AppIcon name="cash-multiple" variant="community" size={14} color="#1E8E3E" />
                  <Text style={styles.revenuePillText}>{toCurrency(row.revenue)}</Text>
                </View>
                {row.pendingPotential > 0 ? (
                  <Text style={styles.pendingPotentialText}>+ {toCurrency(row.pendingPotential)}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.kpiGrid}>
              <Kpi label="Orders" value={row.orders} styles={styles} />
              <Kpi
                label="Completed"
                value={`${row.completed} (${row.completedRate.toFixed(0)}%)`}
                styles={styles}
                tone={row.orders > 0 && row.completedRate < 50 ? "danger" : "default"}
              />
              <Kpi
                label="Cancelled"
                value={`${row.cancelled} (${row.cancelRate.toFixed(0)}%)`}
                styles={styles}
              />
              <Kpi
                label="Oldest Pending"
                value={row.oldestPendingAgeMs == null ? "—" : formatAgeCompact(row.oldestPendingAgeMs)}
                styles={styles}
                tone={
                  row.oldestPendingAgeMs > 7 * DAY_MS
                    ? "danger"
                    : row.oldestPendingAgeMs > 3 * DAY_MS
                      ? "warning"
                      : "default"
                }
                trailingIcon="chevron-right"
                onPress={() =>
                  router.push({
                    pathname: `/admin/merchant/${row.id}/pending-orders`,
                    params: { period: selectedPeriod },
                  })
                }
              />
              <Kpi label="Stores" value={row.stores} styles={styles} />
              <Kpi label="Products" value={row.products} styles={styles} />
            </View>
          </View>
        ))}
      </ScrollView>
      </View>
    </ScreenContainer>
  );
}

function Kpi({
  label,
  value,
  styles,
  tone = "default",
  trailingIcon = "",
  onPress,
}) {
  const isDanger = tone === "danger";
  const isWarning = tone === "warning";
  const content = (
    <>
      <View style={styles.kpiTopRow}>
        <Text
          style={[
            styles.kpiValue,
            isDanger && styles.kpiValueDanger,
            isWarning && styles.kpiValueWarning,
          ]}
        >
          {String(value)}
        </Text>
        {trailingIcon ? (
          <AppIcon
            name={trailingIcon}
            variant="community"
            size={14}
            color={isDanger ? "#C62828" : isWarning ? "#B38300" : "#6B7280"}
          />
        ) : null}
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
    </>
  );

  const style = [
    styles.kpiItem,
    isDanger && styles.kpiItemDanger,
    isWarning && styles.kpiItemWarning,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={style}>{content}</View>;
}

const createStyles = (colors) =>
  StyleSheet.create({
    pageContent: {
      flex: 1,
    },
    searchInput: {
      backgroundColor: colors.input,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      marginBottom: 12,
    },
    filtersRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 12,
      gap: 8,
    },
    filters: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
      flex: 1,
    },
    filterPill: {
      backgroundColor: colors.input,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    filterPillSelected: {
      backgroundColor: colors.text,
    },
    filterText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
    },
    filterTextSelected: {
      color: colors.background,
    },
    reportActions: {
      flexDirection: "row",
      gap: 8,
      marginLeft: "auto",
      alignItems: "center",
    },
    actionIconBtn: {
      backgroundColor: colors.text,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    shareBtn: {
      backgroundColor: "#e2e2e2",
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    previewBtnDisabled: {
      opacity: 0.75,
    },
    sortRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 12,
      zIndex: 20,
    },
    sortDropdownWrap: {
      flex: 1,
      position: "relative",
    },
    sortTrigger: {
      height: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.input,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    sortTriggerText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 16,
      color: colors.text,
      alignSelf: "center",
    },
    sortMenu: {
      position: "absolute",
      top: 46,
      left: 0,
      right: 0,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      zIndex: 40,
      elevation: 4,
      overflow: "hidden",
    },
    sortMenuItem: {
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    sortMenuItemText: {
      fontSize: 12,
      color: colors.text,
    },
    sortMenuItemTextSelected: {
      color: colors.success,
      fontWeight: "700",
    },
    summaryCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
      marginBottom: 12,
    },
    summaryTitle: {
      fontSize: 12,
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    summaryValue: {
      marginTop: 4,
      fontSize: 26,
      fontWeight: "700",
      color: colors.text,
    },
    summaryValueRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
    },
    summaryPendingPotential: {
      fontSize: 14,
      fontWeight: "700",
      color: "#B38300",
      marginBottom: 4,
    },
    summaryMeta: {
      marginTop: 4,
      fontSize: 12,
      color: colors.textSubtle,
    },
    listContent: {
      gap: 10,
      paddingBottom: 8,
    },
    emptyText: {
      marginTop: 20,
      textAlign: "center",
      color: colors.textSubtle,
      fontSize: 13,
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
      gap: 8,
    },
    name: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    username: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSubtle,
    },
    revenuePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "#9BD2A9",
      backgroundColor: "#E8F7EC",
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    revenueWrap: {
      alignItems: "flex-end",
      gap: 4,
    },
    revenuePillText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#1E8E3E",
    },
    pendingPotentialText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#B38300",
    },
    kpiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    kpiItem: {
      width: "31%",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.screen,
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    kpiItemWarning: {
      borderColor: "#E2B24F",
      backgroundColor: "#FFF4CC",
    },
    kpiItemDanger: {
      borderColor: "#D08787",
      backgroundColor: "#FFE0E0",
    },
    kpiValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    kpiTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    kpiValueWarning: {
      color: "#B38300",
    },
    kpiValueDanger: {
      color: "#C62828",
    },
    kpiLabel: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textSubtle,
    },
  });
