const { getDb } = require("./_firebase-node.cjs");

const BATCH_LIMIT = 450;

function parseArgs(argv) {
  const args = {
    apply: false,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--verbose") {
      args.verbose = true;
      continue;
    }
  }

  return args;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

function asCleanString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function collectProductIdFromOrderItem(item) {
  if (!item || typeof item !== "object") return "";

  const directProductId = asCleanString(item.productId);
  if (directProductId) return directProductId;

  const directId = asCleanString(item.id);
  if (directId) return directId;

  const nestedProductId = asCleanString(item.product && item.product.id);
  if (nestedProductId) return nestedProductId;

  return "";
}

async function run() {
  const { apply, verbose } = parseArgs(process.argv.slice(2));
  const db = getDb();

  const [ordersSnap, productsSnap] = await Promise.all([
    db.collection("orders").get(),
    db.collection("products").get(),
  ]);

  const referencedProductIds = new Set();

  for (const orderDoc of ordersSnap.docs) {
    const orderData = orderDoc.data() || {};
    const items = Array.isArray(orderData.items) ? orderData.items : [];
    for (const item of items) {
      const productId = collectProductIdFromOrderItem(item);
      if (productId) referencedProductIds.add(productId);
    }
  }

  const productsToDelete = [];
  let productsKept = 0;

  for (const productDoc of productsSnap.docs) {
    if (referencedProductIds.has(productDoc.id)) {
      productsKept += 1;
      continue;
    }
    productsToDelete.push(productDoc);
  }

  console.log("Delete products not referenced by orders:");
  console.log(`- Orders scanned: ${ordersSnap.size}`);
  console.log(`- Products scanned: ${productsSnap.size}`);
  console.log(`- Referenced product IDs found in orders: ${referencedProductIds.size}`);
  console.log(`- Products to keep: ${productsKept}`);
  console.log(`- Products to delete: ${productsToDelete.length}`);

  if (verbose && productsToDelete.length > 0) {
    console.log("- Product IDs scheduled for deletion:");
    productsToDelete.forEach((docSnap) => console.log(`  - ${docSnap.id}`));
  } else if (productsToDelete.length > 0) {
    console.log("- Sample product IDs to delete:");
    productsToDelete
      .slice(0, 20)
      .forEach((docSnap) => console.log(`  - ${docSnap.id}`));
  }

  if (!apply) {
    console.log("");
    console.log("Dry run only. No products were deleted.");
    console.log("Re-run with --apply to commit deletes.");
    return;
  }

  if (productsToDelete.length === 0) {
    console.log("No products to delete.");
    return;
  }

  const groups = chunk(productsToDelete, BATCH_LIMIT);
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
  console.log(`Done. Deleted ${deleted} products not referenced in orders.`);
}

run().catch((err) => {
  console.error("Failed to delete products not in orders:", err.message);
  process.exit(1);
});
