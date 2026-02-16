const fs = require("fs");
const path = require("path");
const { getDb } = require("./_firebase-node.cjs");

const DEFAULT_INPUT_PATH = path.join(
  process.cwd(),
  "scripts",
  "output",
  "store-product-category-template.json",
);
const BATCH_LIMIT = 450;

function parseArgs(argv) {
  const args = {
    inputPath: DEFAULT_INPUT_PATH,
    apply: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--input" && argv[i + 1]) {
      args.inputPath = path.isAbsolute(argv[i + 1])
        ? argv[i + 1]
        : path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
      continue;
    }
  }

  return args;
}

function normalizeCategory(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

async function run() {
  const { inputPath, apply } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!Array.isArray(raw.stores)) {
    throw new Error("Invalid template: 'stores' array is required.");
  }

  const db = getDb();

  const updates = [];
  const stats = {
    storesInTemplate: raw.stores.length,
    storesWithProposedCategory: 0,
    storesMissingInDb: 0,
    storeCategoryUpdates: 0,
    productCategoryUpdates: 0,
    skippedNoProposedCategory: 0,
    productsScanned: 0,
  };
  const missingStoreIds = [];

  for (const store of raw.stores) {
    const storeId = store?.storeId;
    const category = normalizeCategory(store?.proposedStoreCategory);

    if (!storeId) continue;
    if (!category) {
      stats.skippedNoProposedCategory += 1;
      continue;
    }
    stats.storesWithProposedCategory += 1;

    const storeRef = db.collection("stores").doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) {
      stats.storesMissingInDb += 1;
      missingStoreIds.push(storeId);
      continue;
    }

    const currentStoreCategory = normalizeCategory(storeSnap.data()?.category);
    if (currentStoreCategory !== category) {
      updates.push({
        ref: storeRef,
        data: { category },
        kind: "store",
      });
      stats.storeCategoryUpdates += 1;
    }

    const productsSnap = await db
      .collection("products")
      .where("storeId", "==", storeId)
      .get();

    stats.productsScanned += productsSnap.size;

    productsSnap.docs.forEach((productDoc) => {
      const currentProductCategory = normalizeCategory(productDoc.data()?.category);
      if (currentProductCategory !== category) {
        updates.push({
          ref: productDoc.ref,
          data: { category },
          kind: "product",
        });
        stats.productCategoryUpdates += 1;
      }
    });
  }

  console.log("Category sync plan:");
  console.log(`- Stores in template: ${stats.storesInTemplate}`);
  console.log(
    `- Stores with proposed category: ${stats.storesWithProposedCategory}`,
  );
  console.log(
    `- Stores skipped (no proposed category): ${stats.skippedNoProposedCategory}`,
  );
  console.log(`- Missing stores in DB: ${stats.storesMissingInDb}`);
  console.log(`- Store category updates: ${stats.storeCategoryUpdates}`);
  console.log(`- Products scanned: ${stats.productsScanned}`);
  console.log(`- Product category updates: ${stats.productCategoryUpdates}`);
  console.log(`- Total writes needed: ${updates.length}`);

  if (missingStoreIds.length > 0) {
    console.log("- Missing store IDs:");
    missingStoreIds.forEach((id) => console.log(`  - ${id}`));
  }

  if (!apply) {
    console.log("");
    console.log("Dry run only. No writes were committed.");
    console.log("Re-run with --apply to commit changes.");
    return;
  }

  if (updates.length === 0) {
    console.log("No updates needed. Exiting.");
    return;
  }

  const chunks = chunk(updates, BATCH_LIMIT);
  let committedWrites = 0;

  for (const [index, group] of chunks.entries()) {
    const batch = db.batch();
    group.forEach((item) => {
      batch.update(item.ref, item.data);
    });
    await batch.commit();
    committedWrites += group.length;
    console.log(
      `Committed batch ${index + 1}/${chunks.length} (${group.length} writes)`,
    );
  }

  console.log("");
  console.log(`Done. Committed ${committedWrites} category updates.`);
}

run().catch((err) => {
  console.error("Failed to apply store/product categories:", err.message);
  process.exit(1);
});
