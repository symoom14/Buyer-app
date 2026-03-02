export function normalizeVariantGroups(rawGroups) {
  if (!Array.isArray(rawGroups)) return [];

  return rawGroups
    .map((group, groupIndex) => {
      const name = String(group?.name || "").trim();
      const groupId = String(group?.id || `group_${groupIndex + 1}`);
      const options = Array.isArray(group?.options)
        ? group.options
            .map((option) => String(option || "").trim())
            .filter(Boolean)
        : String(group?.options || "")
            .split(",")
            .map((option) => option.trim())
            .filter(Boolean);

      if (!name || options.length === 0) return null;

      return {
        id: groupId,
        name,
        options: [...new Set(options)],
      };
    })
    .filter(Boolean);
}

export function buildVariantCombinations(variantGroups, maxCount = 120) {
  const groups = normalizeVariantGroups(variantGroups);
  if (groups.length === 0) return [];

  let combinations = [{ options: {} }];
  for (const group of groups) {
    const next = [];
    for (const combo of combinations) {
      for (const option of group.options) {
        next.push({
          options: {
            ...combo.options,
            [group.name]: option,
          },
        });
        if (next.length >= maxCount) break;
      }
      if (next.length >= maxCount) break;
    }
    combinations = next;
    if (combinations.length >= maxCount) break;
  }

  return combinations.map((combo, index) => {
    const label = formatSelectedOptionsLabel(combo.options, groups);
    return {
      id: `variant_${index + 1}`,
      label,
      options: combo.options,
    };
  });
}

export function getDefaultSelectedOptions(variantGroups) {
  const groups = normalizeVariantGroups(variantGroups);
  const result = {};
  groups.forEach((group) => {
    result[group.name] = group.options[0];
  });
  return result;
}

export function resolveSelectedOptions(rawSelection, variantGroups) {
  const groups = normalizeVariantGroups(variantGroups);
  const defaults = getDefaultSelectedOptions(groups);
  const selection = rawSelection && typeof rawSelection === "object" ? rawSelection : {};
  const resolved = { ...defaults };

  groups.forEach((group) => {
    const selectedValue = String(selection[group.name] || "").trim();
    if (group.options.includes(selectedValue)) {
      resolved[group.name] = selectedValue;
    }
  });

  return resolved;
}

export function getVariantSelectionKey(selectedOptions) {
  const entries = Object.entries(selectedOptions || {})
    .map(([group, value]) => [String(group || "").trim(), String(value || "").trim()])
    .filter(([group, value]) => group && value)
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return "default";
  return entries.map(([group, value]) => `${group}:${value}`).join("|");
}

export function getVariantKeyFromOptions(selectedOptions) {
  return getVariantSelectionKey(selectedOptions);
}

export function getCartItemKey(productId, selectedOptions) {
  const id = String(productId || "");
  return `${id}::${getVariantSelectionKey(selectedOptions)}`;
}

export function formatSelectedOptionsLabel(selectedOptions, variantGroups = []) {
  const groups = normalizeVariantGroups(variantGroups);
  const selection = selectedOptions && typeof selectedOptions === "object" ? selectedOptions : {};

  const ordered = groups
    .map((group) => [group.name, String(selection[group.name] || "").trim()])
    .filter(([, value]) => value);

  if (ordered.length === 0) {
    const fallbackEntries = Object.entries(selection)
      .map(([group, value]) => [String(group || "").trim(), String(value || "").trim()])
      .filter(([group, value]) => group && value)
      .sort(([a], [b]) => a.localeCompare(b));
    return fallbackEntries.map(([group, value]) => `${group}: ${value}`).join(" • ");
  }

  return ordered.map(([group, value]) => `${group}: ${value}`).join(" • ");
}

function normalizeStoredVariants(rawVariants) {
  if (!Array.isArray(rawVariants)) return [];
  return rawVariants
    .map((variant, index) => {
      const options =
        variant?.options && typeof variant.options === "object" ? variant.options : {};
      const priceOverrideRaw = variant?.priceOverride;
      const priceOverride =
        priceOverrideRaw === null ||
        priceOverrideRaw === undefined ||
        priceOverrideRaw === ""
          ? null
          : Number(priceOverrideRaw);

      return {
        id: String(variant?.id || `variant_${index + 1}`),
        label: String(variant?.label || ""),
        options,
        priceOverride:
          Number.isFinite(priceOverride) && priceOverride >= 0 ? priceOverride : null,
      };
    })
    .filter(Boolean);
}

export function findMatchingVariant(rawVariants, selectedOptions) {
  const variants = normalizeStoredVariants(rawVariants);
  const targetKey = getVariantSelectionKey(selectedOptions);
  if (!variants.length) return null;

  return (
    variants.find(
      (variant) => getVariantSelectionKey(variant.options) === targetKey,
    ) || null
  );
}

export function resolveVariantUnitPrice(basePrice, rawVariants, selectedOptions) {
  const parsedBase = Number(basePrice);
  const fallbackPrice = Number.isFinite(parsedBase) ? parsedBase : 0;
  const matched = findMatchingVariant(rawVariants, selectedOptions);

  if (
    matched &&
    matched.priceOverride !== null &&
    Number.isFinite(matched.priceOverride)
  ) {
    return matched.priceOverride;
  }

  return fallbackPrice;
}
