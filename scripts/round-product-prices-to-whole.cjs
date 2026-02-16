const { getDb } = require("./_firebase-node.cjs");

function toNearestWhole(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

async function run() {
  const apply = process.argv.includes("--apply");
  const db = getDb();
  const snap = await db.collection("products").get();

  let scanned = 0;
  let wouldUpdate = 0;
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snap.docs) {
    scanned += 1;
    const data = docSnap.data() || {};
    const current = data.price;
    const next = toNearestWhole(current);

    if (next === null) {
      skipped += 1;
      continue;
    }

    if (Number(current) === next) {
      skipped += 1;
      continue;
    }

    wouldUpdate += 1;
    if (apply) {
      await db.collection("products").doc(docSnap.id).update({ price: next });
      updated += 1;
    }
  }

  console.log("Round product prices to whole numbers.");
  console.log(`Scanned: ${scanned}`);
  console.log(`Would update: ${wouldUpdate}`);
  console.log(`Skipped: ${skipped}`);
  if (apply) {
    console.log(`Updated: ${updated}`);
  } else {
    console.log("Dry run only. Re-run with --apply to commit.");
  }
}

run().catch((err) => {
  console.error("Failed to round product prices:", err.message);
  process.exit(1);
});
