const fs = require("fs");
const path = require("path");
const { getDb } = require("./_firebase-node.cjs");

const DEFAULT_INPUT_PATH = path.join(
  process.cwd(),
  "scripts",
  "input-data",
  "dummy-products.json",
);

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input" && argv[i + 1]) {
      args.input = path.isAbsolute(argv[i + 1])
        ? argv[i + 1]
        : path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
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

function toCategoryMapFromProducts(rawProducts) {
  const byNormalized = new Map();
  let missingCategoryRows = 0;

  rawProducts.forEach((row) => {
    const rawCategory = row?.category;
    const normalized = normalizeCategory(rawCategory);
    if (!normalized) {
      missingCategoryRows += 1;
      return;
    }

    if (!byNormalized.has(normalized)) {
      byNormalized.set(normalized, {
        label: String(rawCategory).trim(),
        count: 0,
      });
    }
    byNormalized.get(normalized).count += 1;
  });

  return { byNormalized, missingCategoryRows };
}

function toCategoryMapFromStores(storeDocs) {
  const byNormalized = new Map();
  let missingCategoryStores = 0;

  storeDocs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const rawCategory = data.category;
    const normalized = normalizeCategory(rawCategory);
    if (!normalized) {
      missingCategoryStores += 1;
      return;
    }

    if (!byNormalized.has(normalized)) {
      byNormalized.set(normalized, {
        label: String(rawCategory).trim(),
        count: 0,
      });
    }
    byNormalized.get(normalized).count += 1;
  });

  return { byNormalized, missingCategoryStores };
}

function extractProducts(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  throw new Error(
    "Invalid dummy products JSON shape. Expected array or object with products[].",
  );
}

function printCategoryList(title, categoryMap) {
  const rows = [...categoryMap.values()].sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  console.log(title);
  rows.forEach((row) => {
    console.log(`- ${row.label} (${row.count})`);
  });
  if (!rows.length) {
    console.log("- <none>");
  }
}

async function run() {
  const { input } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(input)) {
    throw new Error(`Input JSON not found: ${input}`);
  }

  const parsed = JSON.parse(fs.readFileSync(input, "utf8"));
  const products = extractProducts(parsed);

  const db = getDb();
  const storesSnap = await db.collection("stores").get();

  const {
    byNormalized: productCategoryMap,
    missingCategoryRows,
  } = toCategoryMapFromProducts(products);
  const {
    byNormalized: storeCategoryMap,
    missingCategoryStores,
  } = toCategoryMapFromStores(storesSnap.docs);

  const productOnly = [...productCategoryMap.keys()].filter(
    (k) => !storeCategoryMap.has(k),
  );
  const storeOnly = [...storeCategoryMap.keys()].filter(
    (k) => !productCategoryMap.has(k),
  );

  console.log("Pre-seed category validation");
  console.log(`- Input file: ${input}`);
  console.log(`- Products loaded: ${products.length}`);
  console.log(`- Stores loaded: ${storesSnap.size}`);
  console.log(`- Unique categories in products: ${productCategoryMap.size}`);
  console.log(`- Unique categories in stores: ${storeCategoryMap.size}`);
  console.log(`- Products missing category: ${missingCategoryRows}`);
  console.log(`- Stores missing category: ${missingCategoryStores}`);
  console.log("");

  printCategoryList("Product categories:", productCategoryMap);
  console.log("");
  printCategoryList("Store categories:", storeCategoryMap);
  console.log("");

  if (productOnly.length) {
    console.log("Categories present in products but missing in stores:");
    productOnly
      .map((k) => productCategoryMap.get(k).label)
      .sort((a, b) => a.localeCompare(b))
      .forEach((label) => console.log(`- ${label}`));
    console.log("");
  }

  if (storeOnly.length) {
    console.log("Categories present in stores but missing in products:");
    storeOnly
      .map((k) => storeCategoryMap.get(k).label)
      .sort((a, b) => a.localeCompare(b))
      .forEach((label) => console.log(`- ${label}`));
    console.log("");
  }

  const hasMismatch = productOnly.length > 0 || storeOnly.length > 0;
  if (hasMismatch) {
    console.error(
      "Category mismatch found. Fix categories before seeding products.",
    );
    process.exit(2);
  }

  console.log("Category validation passed. No category mismatches found.");
}

run().catch((err) => {
  console.error("Failed to validate categories:", err.message);
  process.exit(1);
});
