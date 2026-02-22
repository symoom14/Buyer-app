import { useLocalSearchParams } from "expo-router";
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AppIcon from "../../../src/components/AppIcon";
import ScreenContainer from "../../../src/components/ScreenContainer";
import { auth, db } from "../../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../../src/theme/useAppTheme";
import { notifyCustomerOrderStatus } from "../../../src/utils/notifications";
import { getUserDisplayName } from "../../../src/utils/userDisplayName";

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_ORDER = ["pending", "accepted", "completed"];

export default function MerchantOrderDetailsScreen() {
  const { orderId } = useLocalSearchParams();
  const { colors, isDark } = useAppTheme();

  const [order, setOrder] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [outOfStockItems, setOutOfStockItems] = useState([]);
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const fetchOrder = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, "orders", orderId));
      if (!snap.exists()) return;

      const data = snap.data();
      setOrder(data);

      if (data.customerId) {
        const userSnap = await getDoc(doc(db, "users", data.customerId));
        if (userSnap.exists()) {
          setCustomerName(getUserDisplayName(userSnap.data(), "Unknown user"));
        }
      }

    } catch (err) {
      console.error("Failed to load order:", err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const checkStock = useCallback(async (orderData) => {
    const merchantId = auth.currentUser?.uid;
    if (!merchantId) {
      setOutOfStockItems([]);
      return;
    }

    const merchantItems = (orderData?.items || []).filter(
      (item) => item.merchantId === merchantId,
    );
    const ordersSnap = await getDocs(collection(db, "orders"));
    const orderedByProduct = {};
    ordersSnap.docs.forEach((docSnap) => {
      if (docSnap.id === orderId) return;
      const data = docSnap.data();
      const items = (data.items || []).filter(
        (item) => item.merchantId === merchantId,
      );
      items.forEach((item) => {
        const status =
          data.merchantStatuses?.[merchantId]?.status || data.status || "pending";
        if (status === "cancelled") return;
        if (!item.productId) return;
        orderedByProduct[item.productId] =
          (orderedByProduct[item.productId] || 0) + (item.quantity || 0);
      });
    });
    const productDocs = await Promise.all(
      merchantItems.map((item) =>
        item.productId ? getDoc(doc(db, "products", item.productId)) : null,
      ),
    );

    const stockByProduct = {};
    productDocs.forEach((productSnap, idx) => {
      const item = merchantItems[idx];
      if (!item?.productId || !productSnap || !productSnap.exists()) return;
      stockByProduct[item.productId] = productSnap.data().quantity ?? 0;
    });

    const outOfStock = merchantItems
      .filter((item) => {
        if (!item.productId) return true;
        const initial = stockByProduct[item.productId] ?? 0;
        const ordered = orderedByProduct[item.productId] ?? 0;
        const remaining = initial - ordered;
        return remaining < 0 || remaining < (item.quantity || 0);
      })
      .map((item) => item.name)
      .filter(Boolean);
    setOutOfStockItems(outOfStock);
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    if (order) {
      checkStock(order);
    }
  }, [checkStock, order]);

  const updateStatus = async (newStatus) => {
    if (!order || updatingStatus) return;

    try {
      setUpdatingStatus(true);
      const merchantId = auth.currentUser?.uid;
      if (!merchantId) return;
      const previousStatus =
        order?.merchantStatuses?.[merchantId]?.status || order?.status || "pending";
      const uniqueMerchantIds = new Set(
        (order?.items || [])
          .map((item) => item.merchantId)
          .filter(Boolean),
      );
      const isPartialUpdate = uniqueMerchantIds.size > 1;

      await updateDoc(doc(db, "orders", orderId), {
        status: newStatus,
        statusUpdatedAt: new Date(),
        [`merchantStatuses.${merchantId}`]: {
          status: newStatus,
          statusUpdatedAt: new Date(),
        },
      });

      await notifyCustomerOrderStatus({
        customerId: order.customerId,
        orderId,
        merchantId,
        status: newStatus,
        previousStatus,
        isPartialUpdate,
      });

      // optimistic update
      setOrder((prev) => ({
        ...prev,
        status: newStatus,
        merchantStatuses: {
          ...(prev?.merchantStatuses || {}),
          [merchantId]: {
            status: newStatus,
            statusUpdatedAt: new Date(),
          },
        },
      }));
    } catch (err) {
      console.error("Failed to update order status:", err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const canUpdateToStatus = (targetStatus) => {
    const currentStatus = order?.status || "pending";

    // Can't update if order is cancelled
    if (currentStatus === "cancelled") {
      return false;
    }

    if (outOfStockItems.length > 0) {
      return false;
    }

    // Allow moving to any status in the timeline (forward or backward)
    return (
      STATUS_ORDER.includes(targetStatus) && targetStatus !== currentStatus
    );
  };

  const handleStatusPress = (targetStatus) => {
    if (!canUpdateToStatus(targetStatus)) return;
    updateStatus(targetStatus);
  };

  const handleCancelOrder = () => {
    const currentStatus = order?.status || "pending";

    if (currentStatus === "cancelled" || currentStatus === "completed") {
      return;
    }

    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order? This action cannot be undone.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel Order",
          style: "destructive",
          onPress: () => updateStatus("cancelled"),
        },
      ],
    );
  };

  const handleReopenOrder = () => {
    const currentStatus = order?.status || "pending";
    if (currentStatus !== "cancelled") return;

    Alert.alert(
      "Reopen Order",
      "Reopen this order and set status back to Pending?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reopen",
          style: "default",
          onPress: () => updateStatus("pending"),
        },
      ],
    );
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size="large" />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer>
        <Text style={styles.emptyText}>Order not available.</Text>
      </ScreenContainer>
    );
  }

  const date = order.createdAt?.toDate?.();
  const merchantId = auth.currentUser?.uid;

  const merchantItems = order.items.filter(
    (item) => item.merchantId === merchantId,
  );

  const totalItems = merchantItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  const merchantTotal = merchantItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const currentStatus = order.status || "pending";
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const isCancelled = currentStatus === "cancelled";
  const canCancel =
    currentStatus !== "cancelled" && currentStatus !== "completed";
  const STATUS_STEP_ICONS = {
    pending: "progress-clock",
    accepted: "account-check",
    completed: "truck-fast",
  };
  const STEP_ACTIVE_COLOR = colors.success;
  const STEP_IDLE_COLOR = colors.textSubtle;

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Order Details</Text>
      </View>

      {/* Timeline Stepper */}
      {!isCancelled && outOfStockItems.length === 0 ? (
        <View style={styles.timelineContainer}>
          <View style={styles.timeline}>
            {STATUS_ORDER.map((status, index) => {
              const isActive = currentIndex >= index;
              const isCurrent = currentStatus === status;
              const isClickable = canUpdateToStatus(status);

              return (
                <View key={status} style={styles.timelineStepWrapper}>
                  {/* Connecting Line (before circle) */}
                  {index > 0 && (
                    <View
                      style={[styles.lineLeft, isActive && styles.lineActive]}
                    />
                  )}

                  {/* Step Circle */}
                  <Pressable
                    style={styles.stepContainer}
                    onPress={() => handleStatusPress(status)}
                    disabled={!isClickable}
                  >
                    <View
                      style={[
                        styles.stepCircle,
                        isActive && styles.stepCircleActive,
                        isCurrent && styles.stepCircleCurrent,
                        isClickable && styles.stepCircleClickable,
                      ]}
                    >
                      <AppIcon
                        name={STATUS_STEP_ICONS[status]}
                        variant="community"
                        size={18}
                        color={isActive ? STEP_ACTIVE_COLOR : STEP_IDLE_COLOR}
                      />
                    </View>

                    {/* Label */}
                    <Text
                      style={[
                        styles.stepLabel,
                        isActive && styles.stepLabelActive,
                        isCurrent && styles.stepLabelCurrent,
                      ]}
                    >
                      {STATUS_LABELS[status]}
                    </Text>
                  </Pressable>

                  {/* Connecting Line (after circle) */}
                  {index < STATUS_ORDER.length - 1 && (
                    <View
                      style={[styles.lineRight, isActive && styles.lineActive]}
                    />
                  )}
                </View>
              );
            })}
          </View>

          {/* Cancel Button */}
          {canCancel && (
            <Pressable style={styles.cancelButton} onPress={handleCancelOrder}>
              <AppIcon
                name="close-circle-outline"
                variant="community"
                size={18}
                color={colors.danger}
              />
              <Text style={styles.cancelButtonText}>Cancel Order</Text>
            </Pressable>
          )}
        </View>
      ) : (
        // Cancelled Status Display
        <>
          {isCancelled ? (
            <View style={styles.cancelledBanner}>
              <AppIcon
                name="close-circle"
                variant="community"
                size={24}
                color={colors.background}
              />
              <Text style={styles.cancelledText}>Order Cancelled</Text>
              <Pressable style={styles.reopenButton} onPress={handleReopenOrder}>
                <AppIcon
                  name="refresh"
                  variant="community"
                  size={18}
                  color={colors.danger}
                />
                <Text style={styles.reopenText}>Reopen Order</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.outOfStockBanner}>
              {outOfStockItems.map((name, idx) => (
                <Text key={`${name}-${idx}`} style={styles.outOfStockText}>
                  {name} is out of stock. Please re-stock the product to be
                  able to process the order
                </Text>
              ))}
            </View>
          )}
        </>
      )}

      {/* Meta */}
      <View style={styles.metaBlock}>
        <Text style={styles.meta}>
          <Text style={styles.metaLabel}>Order ID: </Text>
          {orderId}
        </Text>

        <Text style={styles.meta}>
          <Text style={styles.metaLabel}>Date: </Text>
          {date ? date.toLocaleString() : "—"}
        </Text>

        <Text style={styles.meta}>
          <Text style={styles.metaLabel}>Customer: </Text>
          {customerName || "—"}
        </Text>

        <Text style={styles.meta}>
          <Text style={styles.metaLabel}>Total items: </Text>
          {totalItems}
        </Text>
      </View>

      {/* Items table */}
      <View style={styles.table}>
        <View style={styles.rowHeader}>
          <Text style={[styles.cell, styles.flex2]}>Item</Text>
          <Text style={[styles.cell, styles.center]}>Qty</Text>
          <Text style={[styles.cell, styles.right]}>Price</Text>
          <Text style={[styles.cell, styles.right]}>Total</Text>
        </View>

        {merchantItems.map((item, index) => (
          <View key={index} style={styles.row}>
            <Text style={[styles.cell, styles.flex2]}>{item.name}</Text>
            <Text style={[styles.cell, styles.center]}>{item.quantity}</Text>
            <Text style={[styles.cell, styles.right]}>
              ${item.price.toFixed(2)}
            </Text>
            <Text style={[styles.cell, styles.right]}>
              ${(item.price * item.quantity).toFixed(2)}
            </Text>
          </View>
        ))}

        <View style={styles.summaryRow}>
          <Text style={[styles.cell, styles.flex2]}>Totals</Text>
          <Text style={[styles.cell, styles.center]}>{totalItems}</Text>
          <Text style={styles.cell} />
          <Text style={[styles.cell, styles.right]}>
            ${merchantTotal.toFixed(2)}
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const createStyles = (colors, isDark) =>
  StyleSheet.create({
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.text,
  },
  timelineContainer: {
    marginBottom: 24,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  timeline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  timelineStepWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  lineLeft: {
    flex: 1,
    height: 3,
    backgroundColor: colors.border,
  },
  lineRight: {
    flex: 1,
    height: 3,
    backgroundColor: colors.border,
  },
  lineActive: {
    backgroundColor: colors.success,
  },
  stepContainer: {
    alignItems: "center",
    paddingHorizontal: 4,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.background,
  },
  stepCircleActive: {
    backgroundColor: isDark ? colors.successSoft : "#e8f5e9",
    borderColor: colors.success,
  },
  stepCircleCurrent: {
    backgroundColor: isDark ? colors.successSoft : "#e8f5e9",
    borderColor: colors.success,
    borderWidth: 4,
  },
  stepCircleClickable: {
    opacity: 1,
  },
  stepLabel: {
    marginTop: 8,
    fontSize: 11,
    color: colors.textSubtle,
    textAlign: "center",
    fontWeight: "500",
  },
  stepLabelActive: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  stepLabelCurrent: {
    color: isDark ? colors.tint : "#2196F3",
    fontWeight: "700",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingVertical: 10,
    gap: 6,
  },
  cancelButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600",
  },
  cancelledBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 24,
    gap: 10,
  },
  cancelledText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
  outOfStockBanner: {
    marginBottom: 24,
    padding: 14,
    backgroundColor: isDark ? colors.surfaceMuted : "#fff3e0",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  outOfStockText: {
    color: isDark ? colors.warning : "#e65100",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  reopenButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    backgroundColor: colors.surface,
    borderColor: colors.background,
    borderRadius: 16,
  },
  reopenText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "600",
  },
  metaBlock: {
    marginBottom: 20,
  },
  meta: {
    fontSize: 14,
    marginBottom: 6,
    color: colors.textMuted,
  },
  metaLabel: {
    fontWeight: "600",
    color: colors.text,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  rowHeader: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: colors.borderSoft,
  },
  summaryRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderTopWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  cell: {
    paddingHorizontal: 8,
    fontSize: 13,
    color: colors.text,
  },
  flex2: {
    flex: 2,
  },
  center: {
    flex: 1,
    textAlign: "center",
  },
  right: {
    flex: 1,
    textAlign: "right",
  },
  emptyText: {
    color: colors.textSubtle,
  },
});
