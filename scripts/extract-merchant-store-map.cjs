const fs = require("fs");
const path = require("path");
const { getDb } = require("./_firebase-node.cjs");

async function run() {
  const db = getDb();

  const usersSnap = await db.collection("users").where("role", "==", "merchant").get();
  const merchants = usersSnap.docs.map((d) => {
    const data = d.data() || {};
    return {
      merchantId: d.id,
      username: data.username || null,
      email: data.email || null,
      role: data.role || null,
    };
  });

  const storesSnap = await db.collection("stores").get();
  const stores = storesSnap.docs.map((d) => {
    const data = d.data() || {};
    return {
      storeId: d.id,
      name: data.name || null,
      merchantId: data.merchantId || null,
      createdAt: data.createdAt || null,
    };
  });

  const merchantById = new Map(merchants.map((m) => [m.merchantId, m]));
  const pairs = stores
    .filter((s) => s.merchantId && merchantById.has(s.merchantId))
    .map((s) => ({
      merchantId: s.merchantId,
      merchantUsername: merchantById.get(s.merchantId)?.username || null,
      storeId: s.storeId,
      storeName: s.name,
    }));

  const result = {
    generatedAt: new Date().toISOString(),
    totals: {
      merchants: merchants.length,
      stores: stores.length,
      matchedPairs: pairs.length,
    },
    merchants,
    stores,
    matchedMerchantStorePairs: pairs,
  };

  const outDir = path.join(process.cwd(), "scripts", "output");
  const outPath = path.join(outDir, "merchant-store-map.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

  console.log("Merchant/store map generated.");
  console.log(`Output: ${outPath}`);
  console.log(`Merchants: ${merchants.length}`);
  console.log(`Stores: ${stores.length}`);
  console.log(`Matched pairs: ${pairs.length}`);
}

run().catch((err) => {
  console.error("Failed to extract merchant/store map:", err.message);
  process.exit(1);
});
