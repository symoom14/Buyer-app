const { getDb } = require("./_firebase-node.cjs");

const APPLY = process.argv.includes("--apply");

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickKeeper(products) {
  return [...products].sort((a, b) => {
    const createdDiff = toMillis(b.createdAt) - toMillis(a.createdAt);
    if (createdDiff !== 0) return createdDiff;
    return b.id.localeCompare(a.id);
  })[0];
}

async function run() {
  const db = getDb();
  const snap = await db.collection("products").get();

  const byName = new Map();
  for (const d of snap.docs) {
    const data = d.data() || {};
    const normalized = normalizeName(data.name);
    if (!normalized) continue;
    const item = { id: d.id, ...data };
    if (!byName.has(normalized)) byName.set(normalized, []);
    byName.get(normalized).push(item);
  }

  const duplicates = [];
  for (const [normalized, items] of byName.entries()) {
    if (items.length <= 1) continue;
    duplicates.push({ normalized, items });
  }

  let totalDuplicateGroups = duplicates.length;
  let totalProductsToDelete = 0;
  let deletedCount = 0;

  for (const group of duplicates) {
    const keeper = pickKeeper(group.items);
    const remove = group.items.filter((p) => p.id !== keeper.id);
    totalProductsToDelete += remove.length;

    console.log(
      `Duplicate "${group.normalized}" -> keep ${keeper.id} (${keeper.name}), remove ${remove.length}`,
    );

    if (APPLY) {
      for (const product of remove) {
        await db.collection("products").doc(product.id).delete();
        deletedCount += 1;
      }
    }
  }

  console.log(`Duplicate groups: ${totalDuplicateGroups}`);
  console.log(`Products to delete: ${totalProductsToDelete}`);
  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to perform deletions.");
  } else {
    console.log(`Deleted: ${deletedCount}`);
  }
}

run().catch((err) => {
  console.error("Failed to delete duplicate products:", err.message);
  process.exit(1);
});

