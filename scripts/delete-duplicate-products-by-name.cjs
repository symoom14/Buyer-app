const { getDb } = require("./_firebase-node.cjs");

const APPLY = process.argv.includes("--apply");
const BATCH_LIMIT = 450;

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

  const byStoreAndName = new Map();
  for (const d of snap.docs) {
    const data = d.data() || {};
    const storeId = String(data.storeId || "").trim();
    const normalized = normalizeName(data.name);
    if (!normalized || !storeId) continue;
    const item = { id: d.id, ...data };
    const key = `${storeId}::${normalized}`;
    if (!byStoreAndName.has(key)) byStoreAndName.set(key, []);
    byStoreAndName.get(key).push(item);
  }

  const duplicates = [];
  for (const [key, items] of byStoreAndName.entries()) {
    if (items.length <= 1) continue;
    const splitIdx = key.indexOf("::");
    const storeId = key.slice(0, splitIdx);
    const normalized = key.slice(splitIdx + 2);
    duplicates.push({ key, storeId, normalized, items });
  }

  const totalDuplicateGroups = duplicates.length;
  let totalProductsToDelete = 0;
  let mergedQuantityGroups = 0;

  const updates = [];
  const deletes = [];

  for (const group of duplicates) {
    const keeper = pickKeeper(group.items);
    const remove = group.items.filter((p) => p.id !== keeper.id);
    const totalQuantity = group.items.reduce((sum, p) => {
      const q = Number(p.quantity);
      return sum + (Number.isFinite(q) ? q : 0);
    }, 0);

    const keeperQuantity = Number(keeper.quantity);
    if (Number.isFinite(keeperQuantity) && keeperQuantity !== totalQuantity) {
      updates.push({
        ref: db.collection("products").doc(keeper.id),
        data: { quantity: totalQuantity },
      });
      mergedQuantityGroups += 1;
    }

    totalProductsToDelete += remove.length;
    remove.forEach((product) => {
      deletes.push(db.collection("products").doc(product.id));
    });

    console.log(
      `Store ${group.storeId}, "${group.normalized}" -> keep ${keeper.id} (${keeper.name}), remove ${remove.length}, mergedQty=${totalQuantity}`,
    );
  }

  console.log(`Duplicate groups (same store + same name): ${totalDuplicateGroups}`);
  console.log(`Keeper quantity merges: ${mergedQuantityGroups}`);
  console.log(`Products to delete: ${totalProductsToDelete}`);
  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to perform deletions.");
  } else {
    let updatedCount = 0;
    let deletedCount = 0;

    const updateGroups = [];
    for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
      updateGroups.push(updates.slice(i, i + BATCH_LIMIT));
    }
    for (const [index, group] of updateGroups.entries()) {
      const batch = db.batch();
      group.forEach((u) => batch.update(u.ref, u.data));
      await batch.commit();
      updatedCount += group.length;
      console.log(
        `Committed update batch ${index + 1}/${updateGroups.length} (${group.length} writes)`,
      );
    }

    const deleteGroups = [];
    for (let i = 0; i < deletes.length; i += BATCH_LIMIT) {
      deleteGroups.push(deletes.slice(i, i + BATCH_LIMIT));
    }
    for (const [index, group] of deleteGroups.entries()) {
      const batch = db.batch();
      group.forEach((ref) => batch.delete(ref));
      await batch.commit();
      deletedCount += group.length;
      console.log(
        `Committed delete batch ${index + 1}/${deleteGroups.length} (${group.length} deletes)`,
      );
    }

    console.log(`Updated keeper quantities: ${updatedCount}`);
    console.log(`Deleted: ${deletedCount}`);
  }
}

run().catch((err) => {
  console.error("Failed to delete duplicate products:", err.message);
  process.exit(1);
});
