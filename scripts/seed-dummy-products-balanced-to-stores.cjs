const fs = require("fs");
const path = require("path");
const { getAdmin, getDb } = require("./_firebase-node.cjs");

const BATCH_LIMIT = 450;
const DEFAULT_INPUT_PATH = path.join(
  process.cwd(),
  "scripts",
  "input-data",
  "dummy-products.json",
);

function parseArgs(argv) {
  const args = {
    apply: false,
    input: DEFAULT_INPUT_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--input" && argv[i + 1]) {
      args.input = path.isAbsolute(argv[i + 1])
        ? argv[i + 1]
        : path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
      continue;
    }
  }

  return args;
}

function normalizeCategory(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function toText(value) {
  if (value == null) return "";
  return String(value).trim();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toQuantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function extractProducts(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  throw new Error(
    "Invalid input JSON shape. Expected an array or an object with products[].",
  );
}

function pickStoreBalancedRandom(stores, assignedCountByStoreId) {
  let minCount = Number.POSITIVE_INFINITY;
  for (const store of stores) {
    const count = assignedCountByStoreId.get(store.storeId) || 0;
    if (count < minCount) minCount = count;
  }

  const candidates = stores.filter(
    (store) => (assignedCountByStoreId.get(store.storeId) || 0) === minCount,
  );

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  assignedCountByStoreId.set(
    picked.storeId,
    (assignedCountByStoreId.get(picked.storeId) || 0) + 1,
  );
  return picked;
}

async function run() {
  const { apply, input } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const raw = JSON.parse(fs.readFileSync(input, "utf8"));
  const rawProducts = extractProducts(raw);
  const batchId = toText(raw?.batchId) || `seed_${Date.now()}`;

  const db = getDb();
  const admin = getAdmin();
  const storesSnap = await db.collection("stores").get();

  const storesByCategory = new Map();
  let skippedStores = 0;

  storesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const storeId = docSnap.id;
    const storeName = toText(data.name) || "Store";
    const merchantId = toText(data.merchantId);
    const rawCategory = toText(data.category);
    const categoryKey = normalizeCategory(rawCategory);

    if (!merchantId || !categoryKey) {
      skippedStores += 1;
      return;
    }

    if (!storesByCategory.has(categoryKey)) {
      storesByCategory.set(categoryKey, []);
    }
    storesByCategory.get(categoryKey).push({
      storeId,
      storeName,
      merchantId,
      rawCategory,
      categoryKey,
    });
  });

  const validProducts = [];
  const invalidProducts = [];

  rawProducts.forEach((row, index) => {
    const name = toText(row?.name);
    const description = toText(row?.description);
    const category = toText(row?.category);
    const categoryKey = normalizeCategory(category);
    const price = toNumber(row?.price);
    const quantity = toQuantity(row?.quantity);
    const iconName = toText(row?.iconName);

    const hasRequired =
      name &&
      description &&
      category &&
      categoryKey &&
      price != null &&
      quantity != null &&
      iconName;

    if (!hasRequired) {
      invalidProducts.push({ index, name: name || "<missing>" });
      return;
    }

    validProducts.push({
      sourceIndex: index,
      name,
      description,
      category,
      categoryKey,
      price,
      quantity,
      iconName,
    });
  });

  const productsByCategory = new Map();
  validProducts.forEach((product) => {
    if (!productsByCategory.has(product.categoryKey)) {
      productsByCategory.set(product.categoryKey, []);
    }
    productsByCategory.get(product.categoryKey).push(product);
  });

  const assignedCountByStoreId = new Map();
  const writeRows = [];
  const unmatchedCategoryCounts = new Map();

  for (const [categoryKey, products] of productsByCategory.entries()) {
    const categoryStores = storesByCategory.get(categoryKey) || [];
    if (!categoryStores.length) {
      unmatchedCategoryCounts.set(
        categoryKey,
        (unmatchedCategoryCounts.get(categoryKey) || 0) + products.length,
      );
      continue;
    }

    const shuffledProducts = shuffle(products);
    for (const product of shuffledProducts) {
      const pickedStore = pickStoreBalancedRandom(
        categoryStores,
        assignedCountByStoreId,
      );

      writeRows.push({
        ref: db.collection("products").doc(),
        data: {
          name: product.name,
          description: product.description,
          category: product.category,
          storeCategory: pickedStore.rawCategory,
          price: product.price,
          quantity: product.quantity,
          iconName: product.iconName,
          storeId: pickedStore.storeId,
          merchantId: pickedStore.merchantId,
          createdAt: admin.firestore.Timestamp.now(),
          seedBatchId: batchId,
          seedSource: path.basename(input),
        },
      });
    }
  }

  const unmatchedRows = [...unmatchedCategoryCounts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const unmatchedTotal = unmatchedRows.reduce((sum, [, n]) => sum + n, 0);

  console.log("Balanced dummy-product seeding plan:");
  console.log(`- Input: ${input}`);
  console.log(`- Batch ID: ${batchId}`);
  console.log(`- Stores scanned: ${storesSnap.size}`);
  console.log(`- Stores skipped (missing category/merchantId): ${skippedStores}`);
  console.log(`- Products in input: ${rawProducts.length}`);
  console.log(`- Products valid: ${validProducts.length}`);
  console.log(`- Products invalid/skipped: ${invalidProducts.length}`);
  console.log(`- Products with unmatched category stores: ${unmatchedTotal}`);
  console.log(`- Products to create: ${writeRows.length}`);

  if (unmatchedRows.length) {
    console.log("- Unmatched product categories:");
    unmatchedRows.forEach(([key, count]) => console.log(`  - ${key}: ${count}`));
  }

  const byStore = [...assignedCountByStoreId.entries()]
    .map(([storeId, count]) => ({ storeId, count }))
    .sort((a, b) => b.count - a.count);
  if (byStore.length) {
    console.log("- Assignment sample by store (top 20):");
    byStore.slice(0, 20).forEach((row) => {
      console.log(`  - ${row.storeId}: ${row.count}`);
    });
  }

  if (!apply) {
    console.log("");
    console.log("Dry run only. No writes were committed.");
    console.log("Re-run with --apply to commit writes.");
    return;
  }

  if (!writeRows.length) {
    console.log("No products to create.");
    return;
  }

  const groups = chunk(writeRows, BATCH_LIMIT);
  let created = 0;
  for (const [index, group] of groups.entries()) {
    const batch = db.batch();
    group.forEach((row) => batch.set(row.ref, row.data));
    await batch.commit();
    created += group.length;
    console.log(`Committed batch ${index + 1}/${groups.length} (${group.length} writes)`);
  }

  console.log("");
  console.log(`Done. Created ${created} products.`);
}

run().catch((err) => {
  console.error("Failed to seed dummy products with balanced store assignment:", err.message);
  process.exit(1);
});
