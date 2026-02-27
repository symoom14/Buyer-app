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

const NAME_SUFFIXES = [
  "Prime",
  "Plus",
  "Core",
  "Elite",
  "Max",
  "Select",
  "Classic",
  "Signature",
  "Smart",
  "Eco",
  "Pro",
  "Everyday",
];

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
    { name: "Lip Balm", iconName: "lipstick", min: 6, max: 20, description: "Moisturizing lip care for all-day comfort." },
    { name: "Sunscreen SPF 50", iconName: "weather-sunny", min: 10, max: 36, description: "Daily broad-spectrum UV protection with non-greasy finish." },
  ],
  electronics: [
    { name: "Wireless Mouse", iconName: "mouse", min: 15, max: 45, description: "Ergonomic wireless mouse with silent click buttons." },
    { name: "Bluetooth Speaker", iconName: "speaker-wireless", min: 35, max: 120, description: "Portable speaker with punchy bass and long battery life." },
    { name: "Mechanical Keyboard", iconName: "keyboard", min: 65, max: 180, description: "Tactile mechanical keyboard ideal for work and gaming." },
    { name: "USB-C Charger", iconName: "power-plug", min: 18, max: 60, description: "Fast charger compatible with phones, tablets, and laptops." },
    { name: "Portable SSD", iconName: "harddisk", min: 55, max: 210, description: "High-speed portable SSD for backups and media files." },
  ],
  fashion: [
    { name: "Classic Hoodie", iconName: "hanger", min: 28, max: 80, description: "Comfort-fit hoodie made with soft brushed fleece." },
    { name: "Running Shoes", iconName: "shoe-sneaker", min: 55, max: 170, description: "Lightweight running shoes with cushioned sole." },
    { name: "Travel Backpack", iconName: "bag-personal", min: 35, max: 120, description: "Multi-compartment backpack with laptop sleeve." },
    { name: "Cotton T-Shirt", iconName: "tshirt-crew", min: 10, max: 32, description: "Breathable cotton t-shirt in everyday colors." },
    { name: "Leather Belt", iconName: "belt", min: 20, max: 70, description: "Durable leather belt with brushed metal buckle." },
  ],
  grocery: [
    { name: "Organic Coffee Beans", iconName: "coffee", min: 12, max: 28, description: "Medium roast arabica beans with rich chocolate notes." },
    { name: "Premium Olive Oil", iconName: "bottle-tonic", min: 10, max: 30, description: "Cold-pressed extra virgin olive oil for everyday cooking." },
    { name: "Trail Mix Pack", iconName: "food-apple", min: 8, max: 18, description: "Nuts and dried fruit blend for convenient snacking." },
    { name: "Wholegrain Pasta", iconName: "noodles", min: 4, max: 11, description: "Nutritious wholegrain pasta with great texture." },
    { name: "Dark Chocolate Bar", iconName: "candy", min: 3, max: 10, description: "Smooth 70% cocoa chocolate bar with deep flavor." },
  ],
  hardware: [
    { name: "Cordless Drill", iconName: "hammer-drill", min: 45, max: 180, description: "Compact cordless drill for repair and installation tasks." },
    { name: "Adjustable Wrench", iconName: "wrench", min: 20, max: 70, description: "Durable adjustable wrench with a comfortable grip." },
    { name: "Screwdriver Set", iconName: "screwdriver", min: 15, max: 65, description: "Multi-head screwdriver set for precision and standard screws." },
    { name: "Tape Measure", iconName: "tape-measure", min: 8, max: 32, description: "Compact measuring tape for household and workshop tasks." },
    { name: "Safety Gloves", iconName: "gloves", min: 8, max: 28, description: "Protective gloves for heavy-duty handling and repairs." },
  ],
  home: [
    { name: "Ceramic Mug Set", iconName: "cup", min: 16, max: 45, description: "Set of ceramic mugs with matte glaze and easy-grip handles." },
    { name: "Floor Lamp", iconName: "floor-lamp", min: 45, max: 160, description: "Slim floor lamp with warm LED light and modern design." },
    { name: "Storage Basket", iconName: "basket", min: 12, max: 40, description: "Woven storage basket for organizing shelves and closets." },
    { name: "Wall Clock", iconName: "clock-outline", min: 22, max: 75, description: "Minimal wall clock with silent sweep movement." },
    { name: "Throw Pillow", iconName: "sofa", min: 14, max: 38, description: "Soft decorative throw pillow with removable washable cover." },
  ],
  office: [
    { name: "Desk Organizer", iconName: "desk", min: 15, max: 48, description: "Compact organizer for pens, notes, and accessories." },
    { name: "Notebook Bundle", iconName: "notebook", min: 9, max: 26, description: "Set of durable notebooks for study and planning." },
    { name: "Wireless Presenter", iconName: "presentation", min: 20, max: 70, description: "USB presenter with laser pointer and smooth controls." },
    { name: "Ergonomic Chair Cushion", iconName: "chair-rolling", min: 24, max: 65, description: "Memory foam cushion for improved sitting comfort." },
    { name: "Portable SSD", iconName: "harddisk", min: 55, max: 210, description: "High-speed portable SSD for backups and media files." },
  ],
  other: [
    { name: "Everyday Essentials Kit", iconName: "shopping", min: 12, max: 40, description: "Practical essentials pack for everyday household use." },
    { name: "Utility Multi Pack", iconName: "package-variant", min: 10, max: 35, description: "General-purpose bundle with mixed useful items." },
    { name: "Starter Value Bundle", iconName: "gift-outline", min: 15, max: 50, description: "A value bundle designed for flexible daily needs." },
    { name: "Reusable Bottle", iconName: "water", min: 8, max: 24, description: "Reusable bottle built for everyday hydration." },
    { name: "Compact Umbrella", iconName: "umbrella", min: 9, max: 30, description: "Portable umbrella for daily weather protection." },
  ],
  "pet supplies": [
    { name: "Pet Food Bowl", iconName: "bowl", min: 12, max: 34, description: "Stainless steel bowl with anti-slip base." },
    { name: "Dog Leash", iconName: "dog-side", min: 14, max: 40, description: "Comfort-grip leash for daily walks." },
    { name: "Cat Scratcher", iconName: "cat", min: 16, max: 55, description: "Durable scratching board for cats." },
    { name: "Pet Grooming Brush", iconName: "brush", min: 10, max: 28, description: "Gentle grooming brush for shedding control." },
    { name: "Pet Carrier Bag", iconName: "bag-suitcase", min: 30, max: 95, description: "Ventilated carrier bag for safe travel." },
  ],
  sports: [
    { name: "Yoga Mat", iconName: "yoga", min: 22, max: 65, description: "Non-slip yoga mat with extra joint support." },
    { name: "Resistance Bands", iconName: "dumbbell", min: 14, max: 38, description: "Set of resistance bands for full-body training." },
    { name: "Insulated Water Bottle", iconName: "water", min: 18, max: 45, description: "Double-wall insulated bottle that keeps drinks cold." },
    { name: "Skipping Rope", iconName: "jump-rope", min: 8, max: 20, description: "Adjustable speed rope for cardio workouts." },
    { name: "Fitness Tracker Band", iconName: "watch-variant", min: 40, max: 150, description: "Track activity, heart rate, and daily performance." },
  ],
  toys: [
    { name: "Building Block Set", iconName: "toy-brick", min: 25, max: 90, description: "Creative block set for kids and hobby builders." },
    { name: "Remote Car", iconName: "car-sports", min: 30, max: 140, description: "Fast remote-controlled car with rechargeable battery." },
    { name: "Art Supply Kit", iconName: "palette", min: 18, max: 55, description: "Comprehensive art kit with pencils, paints, and brushes." },
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

  if (!Number.isFinite(args.min) || !Number.isFinite(args.max)) {
    throw new Error("Invalid --min/--max values.");
  }

  if (args.count !== null) {
    if (!Number.isFinite(args.count) || args.count < 1) {
      throw new Error("Invalid --count value.");
    }
    args.min = Math.floor(args.count);
    args.max = Math.floor(args.count);
  } else {
    args.min = Math.floor(args.min);
    args.max = Math.floor(args.max);
  }

  if (args.min < 1 || args.max < 1 || args.min > args.max) {
    throw new Error("Expected positive counts and --min <= --max.");
  }

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

function randPrice(min, max) {
  const cents = randInt(min * 100, max * 100);
  return Number((cents / 100).toFixed(2));
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function buildFiveSentenceDescription({ base, storeCategory, price }) {
  return [
    `${base}`,
    `This product is curated for ${storeCategory} stores so category filtering stays accurate.`,
    `The current sample price is $${price.toFixed(2)} to create realistic catalog variation.`,
    "Use this item to test browse, search, cart, and checkout behavior in staging data.",
    "Stock is randomized so low-stock and restock flows can be validated end to end.",
  ].join(" ");
}

function buildUniqueName(baseName, usedNamesInStore) {
  if (!usedNamesInStore.has(normalize(baseName))) {
    usedNamesInStore.add(normalize(baseName));
    return baseName;
  }

  for (const suffix of NAME_SUFFIXES) {
    const candidate = `${baseName} ${suffix}`;
    const key = normalize(candidate);
    if (!usedNamesInStore.has(key)) {
      usedNamesInStore.add(key);
      return candidate;
    }
  }

  for (let c = 65; c <= 90; c += 1) {
    for (let d = 65; d <= 90; d += 1) {
      const candidate = `${baseName} ${String.fromCharCode(c)}${String.fromCharCode(d)}`;
      const key = normalize(candidate);
      if (!usedNamesInStore.has(key)) {
        usedNamesInStore.add(key);
        return candidate;
      }
    }
  }

  throw new Error(`Could not generate unique name for base "${baseName}".`);
}

function allocateCountsEvenly(stores, total) {
  const n = stores.length;
  const base = Math.floor(total / n);
  let remainder = total % n;
  const randomized = shuffle(stores.map((s, idx) => ({ idx, id: s.storeId })));
  const counts = Array(n).fill(base);

  for (let i = 0; i < randomized.length && remainder > 0; i += 1) {
    counts[randomized[i].idx] += 1;
    remainder -= 1;
  }

  return counts;
}

async function run() {
  const { min, max, apply } = parseArgs(process.argv.slice(2));
  const db = getDb();
  const admin = getAdmin();
  const targetTotal = randInt(min, max);

  const [storesSnap, productsSnap] = await Promise.all([
    db.collection("stores").get(),
    db.collection("products").get(),
  ]);

  const existingNamesByStore = new Map();
  productsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const storeId = String(data.storeId || "").trim();
    const nameKey = normalize(data.name);
    if (!storeId || !nameKey) return;
    if (!existingNamesByStore.has(storeId)) {
      existingNamesByStore.set(storeId, new Set());
    }
    existingNamesByStore.get(storeId).add(nameKey);
  });

  const eligibleStores = [];
  const skippedStores = [];
  storesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const storeId = docSnap.id;
    const storeName = String(data.name || "Store");
    const merchantId = String(data.merchantId || "").trim();
    const rawCategory = String(data.category || "").trim();
    const canonical = canonicalCategory(rawCategory);

    if (!merchantId || !rawCategory || !canonical || !CATALOG[canonical]) {
      skippedStores.push({
        storeId,
        storeName,
        rawCategory: rawCategory || "<empty>",
        merchantId: merchantId || "<empty>",
      });
      return;
    }

    if (!existingNamesByStore.has(storeId)) {
      existingNamesByStore.set(storeId, new Set());
    }

    eligibleStores.push({
      storeId,
      storeName,
      merchantId,
      rawCategory,
      canonicalCategory: canonical,
    });
  });

  if (!eligibleStores.length) {
    throw new Error("No eligible stores found. Check store.category and store.merchantId.");
  }

  const perStoreCounts = allocateCountsEvenly(eligibleStores, targetTotal);
  const writes = [];
  const summary = {
    total: targetTotal,
    byCategory: {},
    byStore: {},
  };

  for (let i = 0; i < eligibleStores.length; i += 1) {
    const store = eligibleStores[i];
    const countForStore = perStoreCounts[i];
    const templates = CATALOG[store.canonicalCategory];
    const usedNamesInStore = existingNamesByStore.get(store.storeId);

    for (let j = 0; j < countForStore; j += 1) {
      const template = templates[j % templates.length];
      const name = buildUniqueName(template.name, usedNamesInStore);
      const price = randPrice(template.min, template.max);
      const payload = {
        category: store.rawCategory,
        categoryCanonical: store.canonicalCategory,
        createdAt: admin.firestore.Timestamp.now(),
        description: buildFiveSentenceDescription({
          base: template.description,
          storeCategory: store.rawCategory,
          price,
        }),
        iconName: template.iconName,
        merchantId: store.merchantId,
        name,
        price,
        quantity: randInt(0, 250),
        storeCategory: store.rawCategory,
        storeId: store.storeId,
      };

      writes.push({ ref: db.collection("products").doc(), data: payload });
      summary.byCategory[payload.category] = (summary.byCategory[payload.category] || 0) + 1;
      summary.byStore[store.storeId] = (summary.byStore[store.storeId] || 0) + 1;
    }
  }

  console.log("External seeding script (project-adapted) plan:");
  console.log(`- Products to create: ${writes.length}`);
  console.log(`- Eligible stores: ${eligibleStores.length}`);
  console.log(`- Skipped stores: ${skippedStores.length}`);
  console.log("- Distribution by category:");
  Object.entries(summary.byCategory).forEach(([category, count]) => {
    console.log(`  - ${category}: ${count}`);
  });

  if (skippedStores.length) {
    console.log("- Sample skipped stores:");
    skippedStores.slice(0, 10).forEach((s) => {
      console.log(
        `  - ${s.storeName} (${s.storeId}) category=${s.rawCategory} merchantId=${s.merchantId}`,
      );
    });
  }

  if (!apply) {
    console.log("");
    console.log("Dry run only. No writes were committed.");
    console.log("Re-run with --apply to commit changes.");
    return;
  }

  const groups = chunk(writes, BATCH_LIMIT);
  let created = 0;
  for (const [index, group] of groups.entries()) {
    const batch = db.batch();
    group.forEach((w) => batch.set(w.ref, w.data));
    await batch.commit();
    created += group.length;
    console.log(`Committed batch ${index + 1}/${groups.length} (${group.length} writes)`);
  }

  console.log("");
  console.log(`Done. Created ${created} products.`);
}

run().catch((err) => {
  console.error("Failed to run adapted external seeding script:", err.message);
  process.exit(1);
});
