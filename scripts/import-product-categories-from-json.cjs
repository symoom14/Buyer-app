const fs = require("fs");
const path = require("path");
const { getDb } = require("./_firebase-node.cjs");

const DEFAULT_INPUT = path.join(
  process.cwd(),
  "scripts",
  "products-export-categories-fixed.json",
);
const BATCH_LIMIT = 450;

function parseArgs(argv) {
  const args = {
    apply: false,
    inputPath: DEFAULT_INPUT,
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
  return trimmed.length ? trimmed : null;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

async function run() {
  const { apply, inputPath } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!Array.isArray(parsed.products)) {
    throw new Error("Invalid JSON format: expected a top-level 'products' array.");
  }

  const db = getDb();

  const seenIds = new Set();
  const duplicateIds = new Set();
  const normalizedRows = [];

  parsed.products.forEach((row) => {
    const productId = typeof row?.productId === "string" ? row.productId.trim() : "";
    if (!productId) return;

    if (seenIds.has(productId)) {
      duplicateIds.add(productId);
      return;
    }

    seenIds.add(productId);
    normalizedRows.push({
      productId,
      category: normalizeCategory(row.category),
      name: row.name || null,
    });
  });

  if (duplicateIds.size > 0) {
    throw new Error(
      `Duplicate productId entries found in JSON (${duplicateIds.size}). Resolve duplicates first.`,
    );
  }

  let scanned = 0;
  let skippedNoCategory = 0;
  let missingInDb = 0;
  let unchanged = 0;
  let wouldUpdate = 0;
  let updated = 0;

  const missingIds = [];
  const updates = [];

  for (const row of normalizedRows) {
    scanned += 1;

    if (!row.category) {
      skippedNoCategory += 1;
      continue;
    }

    const ref = db.collection("products").doc(row.productId);
    const snap = await ref.get();
    if (!snap.exists) {
      missingInDb += 1;
      missingIds.push(row.productId);
      continue;
    }

    const currentCategory = normalizeCategory(snap.data()?.category);
    if (currentCategory === row.category) {
      unchanged += 1;
      continue;
    }

    wouldUpdate += 1;
    updates.push({ ref, data: { category: row.category } });
  }

  console.log("Product category import plan:");
  console.log(`- JSON products scanned: ${scanned}`);
  console.log(`- Missing category in JSON: ${skippedNoCategory}`);
  console.log(`- Missing product IDs in Firestore: ${missingInDb}`);
  console.log(`- Unchanged categories: ${unchanged}`);
  console.log(`- Category updates needed: ${wouldUpdate}`);

  if (missingIds.length > 0) {
    console.log("- Missing IDs:");
    missingIds.slice(0, 20).forEach((id) => console.log(`  - ${id}`));
    if (missingIds.length > 20) {
      console.log(`  ...and ${missingIds.length - 20} more`);
    }
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to commit.");
    return;
  }

  if (updates.length === 0) {
    console.log("No updates to apply.");
    return;
  }

  const groups = chunk(updates, BATCH_LIMIT);
  for (const [idx, group] of groups.entries()) {
    const batch = db.batch();
    group.forEach((u) => batch.update(u.ref, u.data));
    await batch.commit();
    updated += group.length;
    console.log(`Committed batch ${idx + 1}/${groups.length} (${group.length})`);
  }

  console.log(`Done. Updated ${updated} product categories.`);
}

run().catch((err) => {
  console.error("Failed to import product categories:", err.message);
  process.exit(1);
});
