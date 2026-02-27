const { getAdmin, getDb } = require("./_firebase-node.cjs");

const BATCH_LIMIT = 450;

const CATEGORY_ALIASES = {
  automotive: "automotive",
  auto: "automotive",
  beauty: "beauty",
  electronics: "electronics",
  tech: "electronics",
  technology: "electronics",
  fashion: "fashion",
  grocery: "grocery",
  groceries: "grocery",
  hardware: "hardware",
  tools: "hardware",
  home: "home",
  house: "home",
  kids: "toys",
  toys: "toys",
  office: "office",
  other: "other",
  pet: "pet supplies",
  pets: "pet supplies",
  "pet supplies": "pet supplies",
  sports: "sports",
};

const CATALOG = {
  automotive: [
    { name: "Car Phone Mount", iconName: "cellphone-link", min: 12, max: 35, description: "Dashboard mount with secure grip and rotation." },
    { name: "Portable Tire Inflator", iconName: "car-tire-alert", min: 35, max: 110, description: "Compact air inflator with digital pressure readout." },
    { name: "Dash Camera", iconName: "camera-front-variant", min: 60, max: 220, description: "Wide-angle dash cam with night recording." },
  ],
  beauty: [
    { name: "Hydrating Face Cream", iconName: "face-man-shimmer", min: 14, max: 45, description: "Daily moisturizer with hyaluronic acid and ceramides." },
    { name: "Vitamin C Serum", iconName: "bottle-soda-classic", min: 18, max: 55, description: "Brightening serum to improve skin radiance." },
    { name: "Body Lotion", iconName: "lotion", min: 12, max: 32, description: "Lightweight lotion for long-lasting hydration." },
  ],
  electronics: [
    { name: "Wireless Mouse", iconName: "mouse", min: 15, max: 45, description: "Ergonomic wireless mouse with silent click buttons." },
    { name: "Bluetooth Speaker", iconName: "speaker-wireless", min: 35, max: 120, description: "Portable speaker with punchy bass and long battery life." },
    { name: "Mechanical Keyboard", iconName: "keyboard", min: 65, max: 180, description: "Tactile mechanical keyboard ideal for work and gaming." },
  ],
  fashion: [
    { name: "Classic Hoodie", iconName: "hanger", min: 28, max: 80, description: "Comfort-fit hoodie made with soft brushed fleece." },
    { name: "Running Shoes", iconName: "shoe-sneaker", min: 55, max: 170, description: "Lightweight running shoes with cushioned sole." },
    { name: "Travel Backpack", iconName: "bag-personal", min: 35, max: 120, description: "Multi-compartment backpack with laptop sleeve." },
  ],
  grocery: [
    { name: "Organic Coffee Beans", iconName: "coffee", min: 12, max: 28, description: "Medium roast arabica beans with rich chocolate notes." },
    { name: "Premium Olive Oil", iconName: "bottle-tonic", min: 10, max: 30, description: "Cold-pressed extra virgin olive oil for everyday cooking." },
    { name: "Trail Mix Pack", iconName: "food-apple", min: 8, max: 18, description: "Nuts and dried fruit blend for convenient snacking." },
  ],
  hardware: [
    { name: "Cordless Drill", iconName: "hammer-drill", min: 45, max: 180, description: "Compact cordless drill for repair and installation tasks." },
    { name: "Adjustable Wrench", iconName: "wrench", min: 20, max: 70, description: "Durable adjustable wrench with a comfortable grip." },
    { name: "Screwdriver Set", iconName: "screwdriver", min: 15, max: 65, description: "Multi-head screwdriver set for precision and standard screws." },
  ],
  home: [
    { name: "Ceramic Mug Set", iconName: "cup", min: 16, max: 45, description: "Set of ceramic mugs with matte glaze and easy-grip handles." },
    { name: "Floor Lamp", iconName: "floor-lamp", min: 45, max: 160, description: "Slim floor lamp with warm LED light and modern design." },
    { name: "Storage Basket", iconName: "basket", min: 12, max: 40, description: "Woven storage basket for organizing shelves and closets." },
  ],
  office: [
    { name: "Desk Organizer", iconName: "desk", min: 15, max: 48, description: "Compact organizer for pens, notes, and accessories." },
    { name: "Notebook Bundle", iconName: "notebook", min: 9, max: 26, description: "Set of durable notebooks for study and planning." },
    { name: "Portable SSD", iconName: "harddisk", min: 55, max: 210, description: "High-speed portable SSD for backups and media files." },
  ],
  other: [
    { name: "Everyday Essentials Kit", iconName: "shopping", min: 12, max: 40, description: "Practical essentials pack for everyday household use." },
    { name: "Utility Multi Pack", iconName: "package-variant", min: 10, max: 35, description: "General-purpose bundle with mixed useful items." },
    { name: "Starter Value Bundle", iconName: "gift-outline", min: 15, max: 50, description: "A value bundle designed for flexible daily needs." },
  ],
  "pet supplies": [
    { name: "Pet Food Bowl", iconName: "bowl", min: 12, max: 34, description: "Stainless steel bowl with anti-slip base." },
    { name: "Dog Leash", iconName: "dog-side", min: 14, max: 40, description: "Comfort-grip leash for daily walks." },
    { name: "Cat Scratcher", iconName: "cat", min: 16, max: 55, description: "Durable scratching board for cats." },
  ],
  sports: [
    { name: "Yoga Mat", iconName: "yoga", min: 22, max: 65, description: "Non-slip yoga mat with extra joint support." },
    { name: "Resistance Bands", iconName: "dumbbell", min: 14, max: 38, description: "Set of resistance bands for full-body training." },
    { name: "Insulated Water Bottle", iconName: "water", min: 18, max: 45, description: "Double-wall insulated bottle that keeps drinks cold." },
  ],
  toys: [
    { name: "Building Block Set", iconName: "toy-brick", min: 25, max: 90, description: "Creative block set for kids and hobby builders." },
    { name: "Puzzle Box", iconName: "puzzle", min: 12, max: 35, description: "Challenging puzzle set for all skill levels." },
    { name: "Plush Toy", iconName: "teddy-bear", min: 10, max: 28, description: "Soft plush toy with premium stitching." },
  ],
};

function parseArgs(argv) {
  const args = {
    min: 100,
    max: 150,
    count: null,
    apply: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--count" && argv[i + 1]) {
      args.count = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--min" && argv[i + 1]) {
      args.min = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--max" && argv[i + 1]) {
      args.max = Number(argv[i + 1]);
      i += 1;
      continue;
    }
  }

  const hasBadNumbers =
    !Number.isFinite(args.min) ||
    !Number.isFinite(args.max) ||
    (args.count !== null && !Number.isFinite(args.count));
  if (hasBadNumbers) {
    throw new Error("Invalid numeric args. Use integers for --count/--min/--max.");
  }

  if (args.count !== null) {
    if (args.count < 1) throw new Error("--count must be >= 1.");
    args.min = args.count;
    args.max = args.count;
  }

  if (args.min < 1 || args.max < 1) {
    throw new Error("--min and --max must be >= 1.");
  }
  if (args.min > args.max) {
    throw new Error("--min cannot be greater than --max.");
  }

  args.min = Math.floor(args.min);
  args.max = Math.floor(args.max);

  return args;
}

function normalize(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function canonicalCategory(rawCategory) {
  const key = normalize(rawCategory);
  return CATEGORY_ALIASES[key] || null;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function randomPrice(min, max) {
  const cents = randInt(min * 100, max * 100);
  return Number((cents / 100).toFixed(2));
}

function uniqueName(base, usedNormalizedNamesInStore) {
  let candidate = base;
  let i = 2;
  while (usedNormalizedNamesInStore.has(normalize(candidate))) {
    candidate = `${base} ${i}`;
    i += 1;
  }
  usedNormalizedNamesInStore.add(normalize(candidate));
  return candidate;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

function buildBalancedCategoryPlan(total, categories) {
  const plan = [];
  while (plan.length < total) {
    const shuffled = [...categories].sort(() => Math.random() - 0.5);
    for (const category of shuffled) {
      if (plan.length >= total) break;
      plan.push(category);
    }
  }
  return plan;
}

async function run() {
  const { min, max, apply } = parseArgs(process.argv.slice(2));
  const db = getDb();
  const admin = getAdmin();
  const targetCount = randInt(min, max);

  const [storesSnap, productsSnap] = await Promise.all([
    db.collection("stores").get(),
    db.collection("products").get(),
  ]);

  const usedNamesByStoreId = new Map();
  productsSnap.docs.forEach((d) => {
    const data = d.data() || {};
    const storeId = String(data.storeId || "").trim();
    if (!storeId) return;
    if (!usedNamesByStoreId.has(storeId)) {
      usedNamesByStoreId.set(storeId, new Set());
    }
    usedNamesByStoreId.get(storeId).add(normalize(data.name));
  });

  const storesByCanonicalCategory = new Map();
  const skippedStores = [];

  storesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const rawStoreCategory = String(data.category || "").trim();
    const canonical = canonicalCategory(rawStoreCategory);

    if (!canonical || !CATALOG[canonical]) {
      skippedStores.push({
        storeId: docSnap.id,
        storeName: data.name || "Store",
        rawCategory: rawStoreCategory || null,
      });
      return;
    }

    if (!storesByCanonicalCategory.has(canonical)) {
      storesByCanonicalCategory.set(canonical, []);
    }

    storesByCanonicalCategory.get(canonical).push({
      storeId: docSnap.id,
      storeName: data.name || "Store",
      merchantId: data.merchantId || null,
      rawCategory: rawStoreCategory || canonical,
      canonicalCategory: canonical,
    });
  });

  const eligibleCategories = Array.from(storesByCanonicalCategory.keys());
  if (!eligibleCategories.length) {
    throw new Error(
      "No eligible stores found with recognized categories. Update store.category first.",
    );
  }

  const categoryPlan = buildBalancedCategoryPlan(targetCount, eligibleCategories);
  const storeCursorByCategory = new Map();
  const writes = [];
  const summary = {
    totalToCreate: targetCount,
    byCategory: {},
    byStore: {},
  };

  for (const category of categoryPlan) {
    const stores = storesByCanonicalCategory.get(category);
    const storeCursor = storeCursorByCategory.get(category) || 0;
    const store = stores[storeCursor % stores.length];
    storeCursorByCategory.set(category, storeCursor + 1);

    const template = sample(CATALOG[category]);
    const price = randomPrice(template.min, template.max);
    const quantity = randInt(10, 120);
    if (!usedNamesByStoreId.has(store.storeId)) {
      usedNamesByStoreId.set(store.storeId, new Set());
    }
    const usedNamesInStore = usedNamesByStoreId.get(store.storeId);
    const name = uniqueName(template.name, usedNamesInStore);
    const productRef = db.collection("products").doc();

    const payload = {
      category: store.rawCategory,
      categoryCanonical: store.canonicalCategory,
      createdAt: admin.firestore.Timestamp.now(),
      description: template.description,
      iconName: template.iconName,
      merchantId: store.merchantId,
      name,
      price,
      quantity,
      storeCategory: store.rawCategory,
      storeId: store.storeId,
    };

    writes.push({ ref: productRef, data: payload });

    summary.byCategory[payload.category] = (summary.byCategory[payload.category] || 0) + 1;
    const storeKey = `${store.storeName} (${store.storeId})`;
    summary.byStore[storeKey] = (summary.byStore[storeKey] || 0) + 1;
  }

  console.log("Category-aware product seeding plan:");
  console.log(`- Products to create: ${summary.totalToCreate}`);
  console.log(`- Eligible categories: ${eligibleCategories.join(", ")}`);
  console.log(`- Stores scanned: ${storesSnap.size}`);
  console.log(`- Stores skipped (unrecognized category): ${skippedStores.length}`);
  console.log("- Product distribution by category:");
  Object.entries(summary.byCategory).forEach(([category, count]) => {
    console.log(`  - ${category}: ${count}`);
  });

  if (skippedStores.length > 0) {
    console.log("- Sample skipped stores:");
    skippedStores.slice(0, 10).forEach((s) => {
      console.log(
        `  - ${s.storeName} (${s.storeId}) category=${s.rawCategory || "<empty>"}`,
      );
    });
  }

  if (!apply) {
    console.log("");
    console.log("Dry run only. No writes were committed.");
    console.log(
      "Re-run with --apply to commit. Optional args: --count 120 or --min 100 --max 150.",
    );
    return;
  }

  let committed = 0;
  const groups = chunk(writes, BATCH_LIMIT);
  for (const [index, group] of groups.entries()) {
    const batch = db.batch();
    group.forEach((w) => batch.set(w.ref, w.data));
    await batch.commit();
    committed += group.length;
    console.log(`Committed batch ${index + 1}/${groups.length} (${group.length} writes)`);
  }

  console.log("");
  console.log(`Done. Created ${committed} products.`);
}

run().catch((err) => {
  console.error("Failed to seed products by store category:", err.message);
  process.exit(1);
});
