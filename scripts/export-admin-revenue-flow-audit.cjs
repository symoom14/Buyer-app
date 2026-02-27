const fs = require("fs");
const path = require("path");
const { getDb } = require("./_firebase-node.cjs");

function serializeValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeValue);

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

function normalizeOrderStatus(value) {
  return String(value || "pending")
    .trim()
    .toLowerCase();
}

function formatOrderTotal(orderData) {
  const directTotal = Number(orderData.totalAmount ?? orderData.total ?? 0);
  if (directTotal > 0) return directTotal;

  const items = Array.isArray(orderData.items) ? orderData.items : [];
  return items.reduce(
    (sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );
}

async function run() {
  const db = getDb();
  const snap = await db.collection("orders").get();

  const includedStatuses = new Set(["pending", "accepted", "completed"]);
  const statusBreakdown = {};
  const includedOrders = [];
  const excludedOrders = [];

  let revenueFlowTotal = 0;

  for (const docSnap of snap.docs) {
    const raw = docSnap.data() || {};
    const status = normalizeOrderStatus(raw.status);
    const orderTotal = formatOrderTotal(raw);

    if (!statusBreakdown[status]) {
      statusBreakdown[status] = { count: 0, total: 0 };
    }
    statusBreakdown[status].count += 1;
    statusBreakdown[status].total += orderTotal;

    const entry = {
      orderId: docSnap.id,
      status,
      total: orderTotal,
      createdAt: serializeValue(raw.createdAt),
      customerId: raw.customerId || "",
    };

    if (includedStatuses.has(status)) {
      revenueFlowTotal += orderTotal;
      includedOrders.push(entry);
    } else {
      excludedOrders.push(entry);
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    logic: {
      description:
        "Matches admin dashboard Revenue Flow tile in app/admin/panel.js",
      includedStatuses: [...includedStatuses],
      amountRule:
        "order.totalAmount > 0 ? totalAmount : (order.total > 0 ? total : sum(items.price * items.quantity))",
      statusRule: "status is normalized; missing status defaults to 'pending'",
    },
    counts: {
      totalOrders: snap.size,
      includedOrders: includedOrders.length,
      excludedOrders: excludedOrders.length,
    },
    revenueFlowTotal,
    statusBreakdown,
    includedOrders,
    excludedOrders,
  };

  const outDir = path.join(process.cwd(), "scripts", "output");
  const outPath = path.join(outDir, "admin-revenue-flow-audit.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

  console.log("Admin revenue flow audit export complete.");
  console.log(`Output: ${outPath}`);
  console.log(`Orders: ${snap.size}`);
  console.log(`Revenue Flow total: ${revenueFlowTotal}`);
}

run().catch((err) => {
  console.error("Failed to export admin revenue flow audit:", err.message);
  process.exit(1);
});
