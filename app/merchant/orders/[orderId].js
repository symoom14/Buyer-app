import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import ScreenContainer from "../../../src/components/ScreenContainer";
import { auth, db } from "../../../src/firebase/firebaseConfig";

const STATUS_COLORS = {
  pending: "#FFB300",
  accepted: "#2196F3",
  completed: "#4CAF50",
  cancelled: "#F44336",
};

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_ORDER = ["pending", "accepted", "completed"];

export default function MerchantOrderDetailsScreen() {
  const { orderId } = useLocalSearchParams();

  const [order, setOrder] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, []);

  const fetchOrder = async () => {
    try {
      const snap = await getDoc(doc(db, "orders", orderId));
      if (!snap.exists()) return;

      const data = snap.data();
      setOrder(data);

      if (data.customerId) {
        const userSnap = await getDoc(doc(db, "users", data.customerId));
        if (userSnap.exists()) {
          setCustomerName(userSnap.data().username);
        }
      }
    } catch (err) {
      console.error("Failed to load order:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus) => {
    if (!order || updatingStatus) return;

    try {
      setUpdatingStatus(true);
      const merchantId = auth.currentUser?.uid;
      if (!merchantId) return;

      await updateDoc(doc(db, "orders", orderId), {
        status: newStatus,
        statusUpdatedAt: new Date(),
        [`merchantStatuses.${merchantId}`]: {
          status: newStatus,
          statusUpdatedAt: new Date(),
        },
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

    // Allow moving to any status in the timeline (forward or backward)
    return (
      STATUS_ORDER.includes(targetStatus) && targetStatus !== currentStatus
    );
  };

  const handleStatusPress = (targetStatus) => {
    if (!canUpdateToStatus(targetStatus)) return;

    const currentStatus = order?.status || "pending";

    Alert.alert(
      "Update Order Status",
      `Change status from "${STATUS_LABELS[currentStatus]}" to "${STATUS_LABELS[targetStatus]}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update",
          style: "default",
          onPress: () => updateStatus(targetStatus),
        },
      ],
    );
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
        <Text>Order not available.</Text>
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

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Order Details</Text>
      </View>

      {/* Timeline Stepper */}
      {!isCancelled ? (
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
                      {isActive && !isCurrent && (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      )}
                      {isCurrent && <View style={styles.currentDot} />}
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
              <Ionicons name="close-circle-outline" size={18} color="#F44336" />
              <Text style={styles.cancelButtonText}>Cancel Order</Text>
            </Pressable>
          )}
        </View>
      ) : (
        // Cancelled Status Display
        <View style={styles.cancelledBanner}>
          <Ionicons name="close-circle" size={24} color="#fff" />
          <Text style={styles.cancelledText}>Order Cancelled</Text>
          <Pressable style={styles.reopenButton} onPress={handleReopenOrder}>
            <Ionicons name="refresh" size={18} color="#F44336" />
            <Text style={styles.reopenText}>Reopen Order</Text>
          </Pressable>
        </View>
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

const styles = StyleSheet.create({
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
  },
  timelineContainer: {
    marginBottom: 24,
    paddingVertical: 16,
    backgroundColor: "#f9f9f9",
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
    backgroundColor: "#ddd",
  },
  lineRight: {
    flex: 1,
    height: 3,
    backgroundColor: "#ddd",
  },
  lineActive: {
    backgroundColor: "#4CAF50",
  },
  stepContainer: {
    alignItems: "center",
    paddingHorizontal: 4,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  stepCircleActive: {
    backgroundColor: "#4CAF50",
  },
  stepCircleCurrent: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
    borderWidth: 4,
  },
  stepCircleClickable: {
    opacity: 1,
  },
  currentDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
  },
  stepLabel: {
    marginTop: 8,
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    fontWeight: "500",
  },
  stepLabelActive: {
    color: "#333",
    fontWeight: "600",
  },
  stepLabelCurrent: {
    color: "#2196F3",
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
    color: "#F44336",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelledBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F44336",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 24,
    gap: 10,
  },
  cancelledText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  reopenButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    backgroundColor: "#ffc7c7",
    borderColor: "#fff",
    borderRadius: 16,
  },
  reopenText: {
    color: "#F44336",
    fontSize: 12,
    fontWeight: "600",
  },
  metaBlock: {
    marginBottom: 20,
  },
  meta: {
    fontSize: 14,
    marginBottom: 6,
  },
  metaLabel: {
    fontWeight: "600",
  },
  table: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    overflow: "hidden",
  },
  rowHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  summaryRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderTopWidth: 2,
    borderColor: "#ddd",
    backgroundColor: "#fafafa",
  },
  cell: {
    paddingHorizontal: 8,
    fontSize: 13,
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
});
