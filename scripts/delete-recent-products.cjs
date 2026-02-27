const { getAdmin, getDb } = require("./_firebase-node.cjs");

const BATCH_LIMIT = 450;

function parseArgs(argv) {
  const args = {
    minutes: 10,
    apply: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--minutes" && argv[i + 1]) {
      args.minutes = Number(argv[i + 1]);
      i += 1;
      continue;
    }
  }

  if (!Number.isFinite(args.minutes) || args.minutes <= 0) {
    throw new Error("Invalid --minutes value. Use a positive number.");
  }

  args.minutes = Math.floor(args.minutes);
  return args;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

async function run() {
  const { minutes, apply } = parseArgs(process.argv.slice(2));
  const db = getDb();
  const admin = getAdmin();

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - minutes * 60 * 1000);
  const cutoffTs = admin.firestore.Timestamp.fromDate(cutoffDate);

  const snap = await db
    .collection("products")
    .where("createdAt", ">=", cutoffTs)
    .get();

  const docs = snap.docs;

  console.log("Recent product delete plan:");
  console.log(`- Window: last ${minutes} minute(s)`);
  console.log(`- Cutoff (local): ${cutoffDate.toLocaleString()}`);
  console.log(`- Matching products: ${docs.length}`);

  if (docs.length > 0) {
    console.log("- Sample product IDs:");
    docs.slice(0, 10).forEach((d) => console.log(`  - ${d.id}`));
  }

  if (!apply) {
    console.log("");
    console.log("Dry run only. No products were deleted.");
    console.log("Re-run with --apply to commit deletes.");
    return;
  }

  if (!docs.length) {
    console.log("No matching products. Nothing to delete.");
    return;
  }

  const groups = chunk(docs, BATCH_LIMIT);
  let deleted = 0;

  for (const [index, group] of groups.entries()) {
    const batch = db.batch();
    group.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += group.length;
    console.log(
      `Committed delete batch ${index + 1}/${groups.length} (${group.length} deletes)`,
    );
  }

  console.log("");
  console.log(`Done. Deleted ${deleted} products created in last ${minutes} minute(s).`);
}

run().catch((err) => {
  console.error("Failed to delete recent products:", err.message);
  process.exit(1);
});
