import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/useAppTheme";

export default function AppIcon({
  name,
  size = 24,
  color,
  variant = "material",
}) {
  const { isDark, colors } = useAppTheme();
  const resolvedColor = color ?? (isDark ? colors.text : "#000");

  if (variant === "community") {
    return (
      <MaterialCommunityIcons name={name} size={size} color={resolvedColor} />
    );
  }

  return <MaterialIcons name={name} size={size} color={resolvedColor} />;
}
