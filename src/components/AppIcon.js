import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";

export default function AppIcon({
  name,
  size = 24,
  color = "#000",
  variant = "material",
}) {
  if (variant === "community") {
    return <MaterialCommunityIcons name={name} size={size} color={color} />;
  }

  return <MaterialIcons name={name} size={size} color={color} />;
}
