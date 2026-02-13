const { getDb } = require("./_firebase-node.cjs");

function stripNumbers(name) {
  const next = String(name || "")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return next;
}

async function run() {
  const db = getDb();
  const snap = await db.collection("products").get();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for (const d of snap.docs) {
    scanned += 1;
    const data = d.data() || {};
    const current = data.name;

    if (typeof current !== "string") {
      skipped += 1;
      continue;
    }

    const next = stripNumbers(current);
    if (!next || next === current) {
      skipped += 1;
      continue;
    }

    await db.collection("products").doc(d.id).update({ name: next });
    updated += 1;
  }

  console.log("Product name cleanup complete.");
  console.log(`Scanned: ${scanned}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
}

run().catch((err) => {
  console.error("Failed to remove numbers from product names:", err.message);
  process.exit(1);
});

