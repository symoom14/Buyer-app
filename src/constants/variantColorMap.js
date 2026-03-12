export const VARIANT_COLOR_HEX_MAP = {
  red: "#E53935",
  blue: "#1E88E5",
  orange: "#F57C00",
  yellow: "#FFA700",
  green: "#2E7D32",


  black: "#121212",
  white: "#EAEAEA",
  grey: "#9E9E9E",
  gray: "#9E9E9E",
  pink: "#EC407A",
};

function normalizeLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function getMappedVariantColor(value) {
  const label = normalizeLabel(value);
  if (!label) return null;

  if (Object.prototype.hasOwnProperty.call(VARIANT_COLOR_HEX_MAP, label)) {
    return VARIANT_COLOR_HEX_MAP[label];
  }

  const tokens = label.split(/[^a-z]+/).filter(Boolean);
  for (const token of tokens) {
    if (Object.prototype.hasOwnProperty.call(VARIANT_COLOR_HEX_MAP, token)) {
      return VARIANT_COLOR_HEX_MAP[token];
    }
  }

  return null;
}

export function getSelectedVariantIconColor(selectedOptions) {
  if (!selectedOptions || typeof selectedOptions !== "object") return null;

  const colorEntry = Object.entries(selectedOptions).find(([groupName]) => {
    const normalizedGroup = normalizeLabel(groupName);
    return normalizedGroup === "color" || normalizedGroup === "colour";
  });

  if (!colorEntry) return null;
  return getMappedVariantColor(colorEntry[1]);
}
