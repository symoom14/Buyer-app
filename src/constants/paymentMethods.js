import { Platform } from "react-native";

const WALLET_PAYMENT_METHOD_ID = "pm_wallet";

const WALLET_PRESET =
  Platform.OS === "android"
    ? {
        id: WALLET_PAYMENT_METHOD_ID,
        label: "Google Pay",
        iconName: "google",
      }
    : {
        id: WALLET_PAYMENT_METHOD_ID,
        label: "Apple Pay",
        iconName: "apple",
      };

export const PAYMENT_METHOD_PRESETS = [
  WALLET_PRESET,
  {
    id: "pm_card_1234",
    label: "Card ending 1234",
    iconName: "credit-card-outline",
  },
  {
    id: "pm_card_5678",
    label: "Card ending 5678",
    iconName: "credit-card-outline",
  },
  {
    id: "pm_afterpay",
    label: "Afterpay",
    iconName: "currency-usd",
  },
  {
    id: "pm_paypal_5432",
    label: "PayPal *5432",
    iconName: "currency-usd",
  },
];

export const DEFAULT_PAYMENT_METHOD_ID = "pm_card_1234";

export function normalizePaymentMethod(method) {
  if (!method) return null;

  const normalizedMethodId = String(method.id || "");
  const isLegacyWalletId =
    normalizedMethodId === "pm_apple_pay" || normalizedMethodId === "pm_google_pay";
  const byId = PAYMENT_METHOD_PRESETS.find((preset) => {
    if (preset.id === WALLET_PAYMENT_METHOD_ID && isLegacyWalletId) {
      return true;
    }
    return preset.id === normalizedMethodId;
  });
  const byLabel = PAYMENT_METHOD_PRESETS.find(
    (preset) => preset.label === method.label || preset.label === method.displayName,
  );
  const preset = byId || byLabel;

  return {
    id: String(
      (isLegacyWalletId ? WALLET_PAYMENT_METHOD_ID : method.id) ||
        preset?.id ||
        `pm_${String(method.label || method.displayName || "custom")
          .toLowerCase()
          .replace(/\s+/g, "_")}`,
    ),
    label:
      preset?.id === WALLET_PAYMENT_METHOD_ID
        ? preset.label
        : method.label || method.displayName || preset?.label || "Payment method",
    iconName:
      preset?.id === WALLET_PAYMENT_METHOD_ID
        ? preset.iconName
        : method.iconName || preset?.iconName || "credit-card-outline",
  };
}
