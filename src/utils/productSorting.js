export const PRODUCT_SORT_MODES = {
  RECOMMENDED: "recommended",
  NEWEST: "newest",
  PRICE_LOW_HIGH: "price_low_high",
  PRICE_HIGH_LOW: "price_high_low",
};

function toMillis(value) {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (
    typeof value === "object" &&
    typeof value.seconds === "number" &&
    typeof value.nanoseconds === "number"
  ) {
    return value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6);
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function hashToUnit(value) {
  const s = String(value || "");
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

export function getRecommendedScore(product, nowMs = Date.now()) {
  const quantity = toNumber(product.quantity);
  const createdMs = toMillis(product.createdAt);
  const price = toNumber(product.price);

  const inStockBoost = quantity > 0 ? 1000 : -1000;
  const stockBoost = Math.min(Math.max(quantity, 0), 100) * 2;

  const ageDays = Math.max(0, (nowMs - createdMs) / (1000 * 60 * 60 * 24));
  const freshnessBoost = Math.max(0, 120 - ageDays);

  const midPrice = price > 0 && price <= 500 ? 20 : 0;
  const diversityJitter = hashToUnit(product.id || product.name) * 5;

  return inStockBoost + stockBoost + freshnessBoost + midPrice + diversityJitter;
}

export function sortProducts(products, mode = PRODUCT_SORT_MODES.RECOMMENDED) {
  const list = [...products];

  if (mode === PRODUCT_SORT_MODES.NEWEST) {
    return list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }

  if (mode === PRODUCT_SORT_MODES.PRICE_LOW_HIGH) {
    return list.sort((a, b) => toNumber(a.price) - toNumber(b.price));
  }

  if (mode === PRODUCT_SORT_MODES.PRICE_HIGH_LOW) {
    return list.sort((a, b) => toNumber(b.price) - toNumber(a.price));
  }

  const nowMs = Date.now();
  return list.sort(
    (a, b) => getRecommendedScore(b, nowMs) - getRecommendedScore(a, nowMs),
  );
}

