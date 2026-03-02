const fs = require("fs");
const path = require("path");
const { getDb } = require("./_firebase-node.cjs");

function normalizeCategory(value) {
  if (value == null) return "";
  return String(value).trim();
}

async function run() {
  const db = getDb();
  const storesSnap = await db.collection("stores").get();

  const categories = new Set();
  storesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const category = normalizeCategory(data.category);
    if (category) categories.add(category);
  });

  const sorted = [...categories].sort((a, b) => a.localeCompare(b));
  const body = sorted.join("\n");

  const outDir = path.join(process.cwd(), "scripts", "output");
  const outPath = path.join(outDir, "store-categories.txt");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, body, "utf8");

  console.log("Store categories export complete.");
  console.log(`Output: ${outPath}`);
  console.log(`Categories: ${sorted.length}`);
}

run().catch((err) => {
  console.error("Failed to export store categories:", err.message);
  process.exit(1);
});
