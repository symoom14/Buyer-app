import { useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import AppIcon from "../../src/components/AppIcon";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";

function formatDate(value) {
  const date = value?.toDate?.() || null;
  if (!date) return "Just now";
  return date.toLocaleString();
}

export default function CustomerNotificationsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");

  const fetchNotifications = useCallback(async (uid) => {
    try {
      setError("");
      const snap = await getDocs(
        query(collection(db, "notifications"), where("recipientId", "==", uid)),
      );

      const rows = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((row) => row.recipientRole === "customer")
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

      const rowsWithSummary = await Promise.all(
        rows.map(async (row) => {
          if (!row.orderId) return { ...row, itemSummary: "Items unavailable" };
          try {
            const orderSnap = await getDoc(doc(db, "orders", row.orderId));
            if (!orderSnap.exists()) return { ...row, itemSummary: "Items unavailable" };

            const orderData = orderSnap.data();
            const scopedItems = (orderData.items || []).filter(
              (item) => item.merchantId === row.merchantId,
            );
            const names = scopedItems.map((item) => item.name).filter(Boolean);
            if (!names.length) return { ...row, itemSummary: "Items unavailable" };

            const firstItem = names[0];
            const remainingCount = names.length - 1;
            return {
              ...row,
              itemSummary:
                remainingCount > 0
                  ? `${firstItem} + ${remainingCount} more`
                  : firstItem,
            };
          } catch (_err) {
            return { ...row, itemSummary: "Items unavailable" };
          }
        }),
      );

      setItems(rowsWithSummary);
    } catch (_err) {
      setError("Failed to load notifications.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (!user) {
          setItems([]);
          setError("Please sign in.");
          return;
        }
        fetchNotifications(user.uid);
      });
      return unsub;
    }, [fetchNotifications]),
  );

  const openNotification = async (item) => {
    if (!item?.orderId || !item?.merchantId) return;

    if (!item.read) {
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, read: true } : row)),
      );
      await updateDoc(doc(db, "notifications", item.id), { read: true });
    }

    router.push(`/customer/orders/${item.orderId}?merchantId=${item.merchantId}`);
  };

  const markAsRead = async (itemId) => {
    const previous = items;
    setItems((prev) =>
      prev.map((row) => (row.id === itemId ? { ...row, read: true } : row)),
    );
    try {
      await updateDoc(doc(db, "notifications", itemId), { read: true });
    } catch (err) {
      setItems(previous);
      console.error("Failed to mark notification as read:", err);
      Alert.alert("Action failed", "You do not have permission for this action.");
    }
  };

  const markAsUnread = async (itemId) => {
    const previous = items;
    setItems((prev) =>
      prev.map((row) => (row.id === itemId ? { ...row, read: false } : row)),
    );
    try {
      await updateDoc(doc(db, "notifications", itemId), { read: false });
    } catch (err) {
      setItems(previous);
      console.error("Failed to mark notification as unread:", err);
      Alert.alert("Action failed", "You do not have permission for this action.");
    }
  };

  const deleteNotification = async (itemId) => {
    const previous = items;
    setItems((prev) => prev.filter((row) => row.id !== itemId));
    try {
      await deleteDoc(doc(db, "notifications", itemId));
    } catch (err) {
      setItems(previous);
      console.error("Failed to delete notification:", err);
      Alert.alert("Delete failed", "You do not have permission to delete this notification.");
    }
  };

  const markAllAsRead = async () => {
    const unreadItems = items.filter((row) => !row.read);
    if (!unreadItems.length) return;

    const previous = items;
    setItems((prev) => prev.map((row) => ({ ...row, read: true })));
    try {
      await Promise.all(
        unreadItems.map((row) =>
          updateDoc(doc(db, "notifications", row.id), { read: true }),
        ),
      );
    } catch (err) {
      setItems(previous);
      console.error("Failed to mark all notifications as read:", err);
      Alert.alert("Action failed", "Could not mark all notifications as read.");
    }
  };
  const clearAllNotifications = async () => {
    if (!items.length) return;

    Alert.alert(
      "Clear all notifications",
      "This will permanently delete all notifications in this list.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: async () => {
            const previous = items;
            setItems([]);
            try {
              await Promise.all(
                previous.map((row) =>
                  deleteDoc(doc(db, "notifications", row.id)),
                ),
              );
            } catch (err) {
              setItems(previous);
              console.error("Failed to clear notifications:", err);
              Alert.alert("Action failed", "Could not clear notifications.");
            }
          },
        },
      ],
    );
  };

  const filteredItems = useMemo(() => {
    if (selectedFilter === "read") return items.filter((item) => !!item.read);
    if (selectedFilter === "unread") return items.filter((item) => !item.read);
    return items;
  }, [items, selectedFilter]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <View style={styles.filters}>
          {[
            { key: "all", label: "All" },
            { key: "read", label: "Read" },
            { key: "unread", label: "Unread" },
          ].map((filter) => {
            const selected = selectedFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                onPress={() => setSelectedFilter(filter.key)}
                style={[
                  styles.filterPill,
                  selected ? styles.filterPillSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected ? styles.filterTextSelected : null,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.filterActions}>
          <TouchableOpacity
            style={[
              styles.markAllButton,
              unreadCount === 0 && styles.markAllButtonDisabled,
            ]}
            onPress={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <AppIcon
              name="check-all"
              variant="community"
              size={18}
              color={unreadCount === 0 ? colors.textSubtle : colors.tint}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.clearAllButton,
              items.length === 0 && styles.clearAllButtonDisabled,
            ]}
            onPress={clearAllNotifications}
            disabled={items.length === 0}
          >
            <AppIcon
              name="notification-clear-all"
              variant="community"
              size={18}
              color={items.length === 0 ? colors.textSubtle : colors.danger}
            />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Swipeable
            overshootLeft={false}
            overshootRight={false}
            renderLeftActions={() => (
              <View style={styles.leftActions}>
                <Pressable
                  style={[styles.circleAction, styles.circleActionUnread]}
                  onPress={() => markAsUnread(item.id)}
                >
                  <AppIcon
                    name="message-badge-outline"
                    variant="community"
                    size={22}
                    color={colors.warning}
                  />
                </Pressable>
              </View>
            )}
            renderRightActions={() => (
              <View style={styles.rightActions}>
                <Pressable
                  style={[styles.circleAction, styles.circleActionRead]}
                  onPress={() => markAsRead(item.id)}
                >
                  <AppIcon
                    name="check"
                    variant="community"
                    size={22}
                    color={isDark ? "#7DD3FC" : colors.tint}
                  />
                </Pressable>
                <Pressable
                  style={[styles.circleAction, styles.circleActionDelete]}
                  onPress={() => deleteNotification(item.id)}
                >
                  <AppIcon
                    name="close"
                    variant="community"
                    size={22}
                    color={colors.danger}
                  />
                </Pressable>
              </View>
            )}
          >
            <Pressable
              style={styles.card}
              onPress={() => openNotification(item)}
            >
              <View style={styles.row}>
                <Text style={styles.message}>{item.message || "Notification"}</Text>
                {!item.read ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.meta}>{item.itemSummary || "Items unavailable"}</Text>
              <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
            </Pressable>
          </Swipeable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <AppIcon
              name="bell-outline"
              variant="community"
              size={36}
              color={colors.textSubtle}
            />
            <Text style={styles.emptyText}>
              {error || (items.length ? "No notifications in this filter." : "No notifications yet.")}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      backgroundColor: colors.screen,
    },
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
      gap: 10,
    },
    filters: {
      flexDirection: "row",
      gap: 8,
      flex: 1,
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
    markAllButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    markAllButtonDisabled: {
      backgroundColor: colors.input,
    },
    filterActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    clearAllButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "#FADDDD",
      alignItems: "center",
      justifyContent: "center",
    },
    clearAllButtonDisabled: {
      backgroundColor: colors.input,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    leftActions: {
      width: 84,
      marginBottom: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    rightActions: {
      flexDirection: "row",
      width: 168,
      marginBottom: 10,
      justifyContent: "space-evenly",
      alignItems: "center",
    },
    circleAction: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    circleActionUnread: {
      backgroundColor: isDark ? "#4A3A22" : "#FFF4DB",
    },
    circleActionRead: {
      backgroundColor: isDark ? "#31465F" : "#CFE5FF",
    },
    circleActionDelete: {
      backgroundColor: isDark ? "#5A3131" : "#F6CACA",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 4,
    },
    message: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      flex: 1,
    },
    dot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: colors.danger,
    },
    meta: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    emptyWrap: {
      marginTop: 100,
      alignItems: "center",
      gap: 8,
    },
    emptyText: {
      color: colors.textSubtle,
      fontSize: 14,
    },
  });
