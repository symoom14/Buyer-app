const { getDb } = require("./_firebase-node.cjs");

function normalizePrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n / 5) * 5;
}

async function run() {
  const db = getDb();
  const snap = await db.collection("products").get();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snap.docs) {
    scanned += 1;
    const data = docSnap.data() || {};
    const current = data.price;
    const next = normalizePrice(current);

    if (next === null) {
      skipped += 1;
      continue;
    }

    if (Number(current) === next) {
      skipped += 1;
      continue;
    }

    await db.collection("products").doc(docSnap.id).update({ price: next });
    updated += 1;
  }

  console.log("Price normalization complete.");
  console.log(`Scanned: ${scanned}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
}

run().catch((err) => {
  console.error("Failed to normalize product prices:", err.message);
  process.exit(1);
});
