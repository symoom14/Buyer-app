import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/useAppTheme";

const COMMUNITY_FALLBACK_ICON = "package-variant-closed";
const MATERIAL_FALLBACK_ICON = "help-outline";

function hasGlyph(iconSet, iconName) {
  if (typeof iconName !== "string" || !iconName.trim()) return false;
  const glyphMap = iconSet?.glyphMap;
  if (!glyphMap || typeof glyphMap !== "object") return false;
  return Object.prototype.hasOwnProperty.call(glyphMap, iconName);
}

export default function AppIcon({
  name,
  size = 24,
  color,
  variant = "material",
}) {
  const { isDark, colors } = useAppTheme();
  const resolvedColor = color ?? (isDark ? colors.text : "#000");

  if (variant === "community") {
    const resolvedName = hasGlyph(MaterialCommunityIcons, name)
      ? name
      : COMMUNITY_FALLBACK_ICON;
    return (
      <MaterialCommunityIcons
        name={resolvedName}
        size={size}
        color={resolvedColor}
      />
    );
  }

  const resolvedName = hasGlyph(MaterialIcons, name)
    ? name
    : MATERIAL_FALLBACK_ICON;
  return <MaterialIcons name={resolvedName} size={size} color={resolvedColor} />;
}
