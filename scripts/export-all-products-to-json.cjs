const fs = require("fs");
const path = require("path");
const { getDb } = require("./_firebase-node.cjs");

function serializeValue(value) {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (typeof value === "object") {
    if (typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }

    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = serializeValue(nested);
    }
    return out;
  }

  return value;
}

async function run() {
  const db = getDb();
  const snap = await db.collection("products").get();

  const products = snap.docs.map((docSnap) => ({
    productId: docSnap.id,
    ...serializeValue(docSnap.data() || {}),
  }));

  const result = {
    generatedAt: new Date().toISOString(),
    totalProducts: products.length,
    products,
  };

  const outDir = path.join(process.cwd(), "scripts", "output");
  const outPath = path.join(outDir, "products-export.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

  console.log("Product export complete.");
  console.log(`Output: ${outPath}`);
  console.log(`Products: ${products.length}`);
}

run().catch((err) => {
  console.error("Failed to export products:", err.message);
  process.exit(1);
});
