import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import AppIcon from "./AppIcon";

export default function DashboardSection({
  title,
  tiles = [],
  onShowMore,
  layout = "scroll",
  disabled = false,
}) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>

        {!disabled && typeof onShowMore === "function" && (
          <TouchableOpacity onPress={onShowMore}>
            <Text style={styles.showMore}>Show more</Text>
          </TouchableOpacity>
        )}
      </View>

      {layout === "grid" ? (
        <View style={styles.grid}>
          {tiles.map((tile, index) => {
            const TileWrapper = tile.onPress ? TouchableOpacity : View;
            const tileStyle = [
              styles.tile,
              styles.tileGrid,
              tile.backgroundColor && { backgroundColor: tile.backgroundColor },
              tile.borderColor && { borderColor: tile.borderColor },
            ];
            const iconColor = tile.iconColor || "#555";
            const textStyle = [
              styles.tileText,
              tile.textColor && { color: tile.textColor },
            ];
            return (
              <TileWrapper
                key={index}
                style={tileStyle}
                onPress={tile.onPress}
                disabled={!tile.onPress}
              >
                <AppIcon
                  name={tile.icon || "apps"}
                  variant={tile.iconVariant || "material"}
                  size={28}
                  color={iconColor}
                />
                <Text style={textStyle}>{tile.title}</Text>
              </TileWrapper>
            );
          })}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tiles.map((tile, index) => {
          const TileWrapper = tile.onPress ? TouchableOpacity : View;
          const tileStyle = [
            styles.tile,
            tile.backgroundColor && { backgroundColor: tile.backgroundColor },
            tile.borderColor && { borderColor: tile.borderColor },
          ];
          const iconColor = tile.iconColor || "#555";
          const textStyle = [
            styles.tileText,
            tile.textColor && { color: tile.textColor },
          ];
          return (
            <TileWrapper
              key={index}
              style={tileStyle}
              onPress={tile.onPress}
              disabled={!tile.onPress}
            >
              <AppIcon
                name={tile.icon || "apps"}
                variant={tile.iconVariant || "material"}
                size={28}
                color={iconColor}
              />
              <Text style={textStyle}>{tile.title}</Text>
            </TileWrapper>
          );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  showMore: {
    fontSize: 14,
    color: "#007AFF",
  },
  tile: {
    width: 160,
    height: 100,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tileGrid: {
    width: 160,
    marginRight: 0,
  },
  tileText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
  },
});
