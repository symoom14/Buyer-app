const fs = require("fs");
const path = require("path");
const { getDb } = require("./_firebase-node.cjs");

function asIso(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return null;
}

async function run() {
  const db = getDb();

  const [usersSnap, storesSnap, productsSnap] = await Promise.all([
    db.collection("users").where("role", "==", "merchant").get(),
    db.collection("stores").get(),
    db.collection("products").get(),
  ]);

  const merchantById = new Map();
  usersSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    merchantById.set(docSnap.id, {
      merchantId: docSnap.id,
      username: data.username || null,
      name: data.name || null,
      displayName: data.name || data.username || null,
    });
  });

  const productsByStoreId = new Map();
  productsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const storeId = data.storeId || null;
    if (!storeId) return;

    if (!productsByStoreId.has(storeId)) {
      productsByStoreId.set(storeId, []);
    }

    productsByStoreId.get(storeId).push({
      productId: docSnap.id,
      name: data.name || null,
      category: data.category || null,
      iconName: data.iconName || null,
      merchantId: data.merchantId || null,
      price: data.price ?? null,
      quantity: data.quantity ?? null,
      createdAt: asIso(data.createdAt),
    });
  });

  const stores = storesSnap.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    const merchantId = data.merchantId || null;
    const merchant = merchantById.get(merchantId) || null;
    const products = productsByStoreId.get(docSnap.id) || [];

    return {
      storeId: docSnap.id,
      name: data.name || null,
      merchantId,
      merchantDisplayName: merchant?.displayName || null,
      existingStoreCategory: data.category || null,
      proposedStoreCategory: data.category || null,
      createdAt: asIso(data.createdAt),
      productCount: products.length,
      products,
    };
  });

  const result = {
    generatedAt: new Date().toISOString(),
    notes: [
      "Edit only 'proposedStoreCategory' for each store.",
      "Injector script can copy proposedStoreCategory to store.category and product.category for all products in the store.",
    ],
    totals: {
      merchants: merchantById.size,
      stores: stores.length,
      products: productsSnap.size,
    },
    stores,
  };

  const outDir = path.join(process.cwd(), "scripts", "output");
  const outPath = path.join(outDir, "store-product-category-template.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

  console.log("Store/product category template generated.");
  console.log(`Output: ${outPath}`);
  console.log(`Stores: ${stores.length}`);
  console.log(`Products: ${productsSnap.size}`);
}

run().catch((err) => {
  console.error("Failed to export store/product category template:", err.message);
  process.exit(1);
});
