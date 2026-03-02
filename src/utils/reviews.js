import { collection, getDocs, query, where } from "firebase/firestore";

export function buildRatingSummaryFromRatings(ratings = []) {
  const valid = ratings
    .map((value) => Number(value))
    .filter((value) => value >= 1 && value <= 5);

  const count = valid.length;
  const average = count
    ? Number((valid.reduce((sum, value) => sum + value, 0) / count).toFixed(2))
    : 0;

  return { average, count };
}

export async function fetchMerchantRatingSummary(db, merchantId) {
  const id = String(merchantId || "").trim();
  if (!id) return { average: 0, count: 0 };

  const snapshot = await getDocs(
    query(collection(db, "productReviews"), where("merchantId", "==", id)),
  );
  const ratings = snapshot.docs.map((docSnap) => docSnap.data()?.rating);
  return buildRatingSummaryFromRatings(ratings);
}

export function buildProductRatingSummaryMap(reviews = []) {
  const groupedRatings = {};
  reviews.forEach((review) => {
    const productId = String(review?.productId || "").trim();
    if (!productId) return;
    if (!groupedRatings[productId]) {
      groupedRatings[productId] = [];
    }
    groupedRatings[productId].push(review?.rating);
  });

  return Object.entries(groupedRatings).reduce((acc, [productId, ratings]) => {
    acc[productId] = buildRatingSummaryFromRatings(ratings);
    return acc;
  }, {});
}

export async function fetchProductRatingSummaryMap(db, productIds = []) {
  const includeSet = new Set(
    (productIds || []).map((id) => String(id || "").trim()).filter(Boolean),
  );
  const snapshot = await getDocs(collection(db, "productReviews"));
  const reviews = snapshot.docs
    .map((docSnap) => docSnap.data() || {})
    .filter((review) => {
      if (includeSet.size === 0) return true;
      const productId = String(review?.productId || "").trim();
      return includeSet.has(productId);
    });

  return buildProductRatingSummaryMap(reviews);
}
