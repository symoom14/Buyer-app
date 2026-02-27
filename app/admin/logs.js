import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import ScreenContainer from "../../src/components/ScreenContainer";
import { db } from "../../src/firebase/firebaseConfig";
import { useAppTheme } from "../../src/theme/useAppTheme";

const toDate = (value) => {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return null;
};

const ACTION_FILTERS = [
  { key: "all", label: "All" },
  { key: "user", label: "Users" },
  { key: "store", label: "Stores" },
  { key: "product", label: "Products" },
];

const getActionEdgeColor = (action) => {
  const normalized = String(action || "").trim().toLowerCase();
  if (normalized.includes("created")) return "#1E8E3E";
  if (normalized.includes("deleted")) return "#C62828";
  return "#FA8F02";
};

export default function AdminLogsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "adminLogs"), (snap) => {
      const rows = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .sort((a, b) => {
          const aMs = toDate(a.createdAt)?.getTime?.() || 0;
          const bMs = toDate(b.createdAt)?.getTime?.() || 0;
          return bMs - aMs;
        });
      setLogs(rows);
    });

    return () => unsub();
  }, []);

  const visibleLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const byFilter =
      selectedFilter === "all"
        ? logs
        : logs.filter((entry) => {
            if (selectedFilter === "user") return entry.targetType === "user";
            if (selectedFilter === "store") return entry.targetType === "store";
            if (selectedFilter === "product") return entry.targetType === "product";
            return true;
          });

    if (!q) return byFilter;

    return byFilter.filter((entry) => {
      const action = String(entry.action || "").toLowerCase();
      const label = String(entry.targetLabel || "").toLowerCase();
      const targetId = String(entry.targetId || "").toLowerCase();
      const actorEmail = String(entry.actorEmail || "").toLowerCase();
      return (
        action.includes(q) ||
        label.includes(q) ||
        targetId.includes(q) ||
        actorEmail.includes(q)
      );
    });
  }, [logs, searchQuery, selectedFilter]);

  return (
    <ScreenContainer disableBottomInset bottomPadding={12}>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search by action, target, id, or admin email"
        placeholderTextColor={colors.textSubtle}
        style={styles.searchInput}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      <View style={styles.filterRow}>
        {ACTION_FILTERS.map((filter) => {
          const selected = selectedFilter === filter.key;
          return (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterPill, selected && styles.filterPillSelected]}
              onPress={() => setSelectedFilter(filter.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {visibleLogs.length === 0 ? (
          <Text style={styles.emptyText}>No log entries found.</Text>
        ) : null}

        {visibleLogs.map((entry) => {
          const when = toDate(entry.createdAt);
          const edgeColor = getActionEdgeColor(entry.action);
          return (
            <View
              key={entry.id}
              style={[styles.card, { borderLeftColor: edgeColor }]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.action}>{String(entry.action || "unknown").replaceAll("_", " ")}</Text>
                <Text style={styles.when}>
                  {when ? when.toLocaleString() : "pending..."}
                </Text>
              </View>

              <Text style={styles.meta}>Type: {entry.targetType || "—"}</Text>
              <Text style={styles.meta}>Target: {entry.targetLabel || "—"}</Text>
              <Text style={styles.meta}>Target ID: {entry.targetId || "—"}</Text>
              <Text style={styles.meta}>By: {entry.actorEmail || "Unknown admin"}</Text>
            </View>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    searchInput: {
      backgroundColor: colors.input,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      marginBottom: 10,
    },
    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },
    filterPill: {
      backgroundColor: colors.input,
      borderRadius: 999,
      paddingHorizontal: 12,
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
    content: {
      gap: 10,
      paddingBottom: 12,
    },
    emptyText: {
      marginTop: 16,
      textAlign: "center",
      color: colors.textSubtle,
      fontSize: 13,
    },
    card: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      backgroundColor: colors.surface,
      padding: 12,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    action: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      textTransform: "capitalize",
    },
    when: {
      fontSize: 11,
      color: colors.textSubtle,
    },
    meta: {
      marginTop: 3,
      fontSize: 12,
      color: colors.textSubtle,
    },
  });
