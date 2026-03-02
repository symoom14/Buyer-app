const { getDb } = require("./_firebase-node.cjs");

const BATCH_LIMIT = 450;
const MAX_KEYWORDS = 40;

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
  "your",
]);

const CATEGORY_KEYWORDS = {
  appliances: [
    "appliance",
    "home appliance",
    "kitchen",
    "cooking",
    "household",
  ],
  beauty: [
    "beauty",
    "skincare",
    "haircare",
    "personal care",
    "self care",
  ],
  electronics: [
    "electronics",
    "tech",
    "gadget",
    "device",
    "accessory",
  ],
  fashion: [
    "fashion",
    "clothing",
    "apparel",
    "wear",
    "style",
  ],
  groceries: [
    "grocery",
    "food",
    "kitchen",
    "pantry",
    "cooking",
  ],
  home: ["home", "household", "living", "decor", "organizing"],
  office: ["office", "work", "stationery", "workspace", "productivity"],
  other: ["general", "everyday", "household"],
  pets: ["pet", "pets", "pet care", "animal", "pet supplies"],
  sports: ["sports", "fitness", "exercise", "workout", "training"],
  tools: ["tools", "hardware", "repair", "maintenance", "diy"],
};

const PHRASE_RULES = [
  { matches: ["laundry detergent", "detergent"], add: ["cleaning", "laundry", "stain removal", "wash"] },
  { matches: ["dish soap", "dishwashing liquid"], add: ["cleaning", "kitchen cleaning", "dishwashing"] },
  { matches: ["all purpose cleaner", "surface cleaner"], add: ["cleaning", "home cleaning", "disinfecting"] },
  { matches: ["mop", "broom"], add: ["cleaning", "floor cleaning"] },
  { matches: ["vacuum"], add: ["cleaning", "floor cleaning", "dust removal"] },
  { matches: ["refrigerator", "fridge"], add: ["appliances", "kitchen appliance", "cooling"] },
  { matches: ["microwave"], add: ["appliances", "kitchen appliance", "heating"] },
  { matches: ["blender"], add: ["appliances", "kitchen appliance", "mixing"] },
  { matches: ["air fryer"], add: ["appliances", "kitchen appliance", "cooking"] },
  { matches: ["washing machine"], add: ["appliances", "laundry", "cleaning"] },
  { matches: ["dryer"], add: ["appliances", "laundry"] },
  { matches: ["drill", "screwdriver", "wrench", "hammer", "pliers"], add: ["tools", "hardware", "repair", "diy"] },
  { matches: ["sunscreen", "spf"], add: ["beauty", "sun protection", "skincare"] },
  { matches: ["serum", "moisturizer", "cleanser"], add: ["beauty", "skincare"] },
  { matches: ["shampoo", "conditioner"], add: ["beauty", "haircare"] },
  { matches: ["earbuds", "headphones", "speaker"], add: ["electronics", "audio"] },
  { matches: ["charger", "power bank", "cable"], add: ["electronics", "charging"] },
  { matches: ["keyboard", "mouse", "webcam"], add: ["electronics", "computer accessory"] },
  { matches: ["coffee", "olive oil", "pasta", "snack"], add: ["groceries", "food"] },
  { matches: ["pet food", "leash", "cat", "dog"], add: ["pets", "pet care"] },
];

function parseArgs(argv) {
  const args = {
    apply: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--apply") args.apply = true;
  }
  return args;
}

function normalizeWhitespace(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeText(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value) {
  const text = normalizeText(value);
  if (!text) return [];
  return text
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function normalizeCategory(value) {
  const c = normalizeText(value);
  if (c === "pet supplies") return "pets";
  if (c === "pet") return "pets";
  if (c === "grocery") return "groceries";
  if (c === "tool") return "tools";
  return c;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

function sameKeywordSet(a, b) {
  if (a.length !== b.length) return false;
  const sa = new Set(a.map((x) => normalizeText(x)));
  for (const item of b) {
    if (!sa.has(normalizeText(item))) return false;
  }
  return true;
}

function buildKeywords(product) {
  const name = normalizeWhitespace(product?.name);
  const description = normalizeWhitespace(product?.description);
  const rawCategory = normalizeWhitespace(product?.category);
  const category = normalizeCategory(rawCategory);
  const combined = normalizeText(`${name} ${description} ${rawCategory}`);

  const out = [];
  const seen = new Set();
  const push = (kw) => {
    const normalized = normalizeWhitespace(kw).toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  if (name) push(name.toLowerCase());
  if (rawCategory) push(rawCategory.toLowerCase());

  tokenize(name).forEach(push);
  tokenize(description).slice(0, 30).forEach(push);

  if (category && CATEGORY_KEYWORDS[category]) {
    CATEGORY_KEYWORDS[category].forEach(push);
  }

  PHRASE_RULES.forEach((rule) => {
    if (rule.matches.some((phrase) => combined.includes(phrase))) {
      rule.add.forEach(push);
    }
  });

  return out.slice(0, MAX_KEYWORDS);
}

async function run() {
  const { apply } = parseArgs(process.argv.slice(2));
  const db = getDb();
  const productsSnap = await db.collection("products").get();

  const updates = [];
  let unchanged = 0;

  productsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const nextKeywords = buildKeywords(data);
    const currentKeywords = Array.isArray(data.searchKeywords)
      ? data.searchKeywords.map((x) => normalizeWhitespace(x)).filter(Boolean)
      : [];

    if (sameKeywordSet(currentKeywords, nextKeywords)) {
      unchanged += 1;
      return;
    }

    updates.push({
      ref: docSnap.ref,
      data: { searchKeywords: nextKeywords },
      sampleName: String(data.name || docSnap.id),
      count: nextKeywords.length,
    });
  });

  console.log("Product search keyword retrofit plan:");
  console.log(`- Products scanned: ${productsSnap.size}`);
  console.log(`- Products unchanged: ${unchanged}`);
  console.log(`- Products to update: ${updates.length}`);

  if (updates.length > 0) {
    console.log("- Sample updates:");
    updates.slice(0, 15).forEach((u) => {
      console.log(`  - ${u.sampleName} (${u.count} keywords)`);
    });
  }

  if (!apply) {
    console.log("");
    console.log("Dry run only. No writes were committed.");
    console.log("Re-run with --apply to write searchKeywords.");
    return;
  }

  if (!updates.length) {
    console.log("No updates needed.");
    return;
  }

  const groups = chunk(updates, BATCH_LIMIT);
  let committed = 0;

  for (const [index, group] of groups.entries()) {
    const batch = db.batch();
    group.forEach((u) => batch.update(u.ref, u.data));
    await batch.commit();
    committed += group.length;
    console.log(`Committed batch ${index + 1}/${groups.length} (${group.length} writes)`);
  }

  console.log("");
  console.log(`Done. Updated ${committed} products with searchKeywords.`);
}

run().catch((err) => {
  console.error("Failed to retrofit product search keywords:", err.message);
  process.exit(1);
});
