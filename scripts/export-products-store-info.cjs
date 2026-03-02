const fs = require("fs");
const path = require("path");
const { getDb } = require("./_firebase-node.cjs");

function asText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

async function run() {
  const db = getDb();

  const [storesSnap, productsSnap] = await Promise.all([
    db.collection("stores").get(),
    db.collection("products").get(),
  ]);

  const storeById = new Map();
  storesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    storeById.set(docSnap.id, {
      storeName: asText(data.name),
      storeCategory: asText(data.category),
    });
  });

  const rows = productsSnap.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    const storeId = asText(data.storeId);
    const store = storeId ? storeById.get(storeId) : null;

    return {
      productName: asText(data.name),
      productCategory: asText(data.category),
      productDescription: asText(data.description),
      storeName: store?.storeName || null,
      storeCategory: store?.storeCategory || asText(data.storeCategory),
    };
  });

  const result = {
    generatedAt: new Date().toISOString(),
    totalProducts: rows.length,
    fields: [
      "productName",
      "productCategory",
      "productDescription",
      "storeName",
      "storeCategory",
    ],
    products: rows,
  };

  const outDir = path.join(process.cwd(), "scripts", "output");
  const outPath = path.join(outDir, "products-store-info-export.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

  console.log("Products store info export complete.");
  console.log(`Output: ${outPath}`);
  console.log(`Products: ${rows.length}`);
}

run().catch((err) => {
  console.error("Failed to export products store info:", err.message);
  process.exit(1);
});
