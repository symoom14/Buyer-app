const { getAdmin, getDb } = require("./_firebase-node.cjs");

const TARGET_MERCHANTS = [
  "hardwaremarks",
  "homelyliving",
  "pawspets",
  "blazetech",
  "fairbeautyproducts",
];

const CATALOG = {
  hardwaremarks: {
    category: "Hardware",
    iconPool: ["hammer", "wrench", "screwdriver", "toolbox", "tape-measure"],
    bases: [
      "ForgeLine Drill Kit",
      "IronGrip Hammer Set",
      "BoltMaster Wrench Pack",
      "Precision Screwdriver Bundle",
      "ProMeasure Tape Set",
      "Titan Utility Knife",
      "QuickFix Fastener Box",
      "HeavyDuty Clamp Pair",
      "Carbide Bit Assortment",
      "Workshop Safety Gloves",
      "Impact Driver Essentials",
      "RivetPro Hand Tool",
      "HexKey Master Set",
      "Laser Level Starter",
      "Builder Socket Collection",
    ],
    priceRange: [18, 180],
  },
  homelyliving: {
    category: "Home",
    iconPool: ["sofa", "lamp", "vase", "basket", "table-furniture"],
    bases: [
      "CozyNest Cushion Pair",
      "WarmGlow Table Lamp",
      "CalmStone Ceramic Vase",
      "LinenHarmony Runner",
      "SoftCloud Throw Blanket",
      "OakTone Storage Basket",
      "MinimalWall Frame Trio",
      "Nordic Planter Pot",
      "AromaCandle Gift Set",
      "Velvet Accent Pillow",
      "Rustic Shelf Organizer",
      "Sunbeam Curtain Tiebacks",
      "Woodgrain Serving Tray",
      "LeafPattern Rug Mat",
      "Modern Entryway Mirror",
    ],
    priceRange: [14, 140],
  },
  pawspets: {
    category: "Pet Supplies",
    iconPool: ["dog-side", "cat", "bowl", "bone", "paw"],
    bases: [
      "PawCare Feeding Bowl",
      "TailTrail Dog Leash",
      "Whisker Scratcher Pad",
      "PetShield Travel Carrier",
      "HappyPaws Chew Toy",
      "SoftNap Pet Bed",
      "FurFresh Grooming Brush",
      "CalmPet Shampoo",
      "BarkSafe Harness",
      "CozyPaw Blanket",
      "PouncePlay Toy Pack",
      "TreatKeeper Storage Jar",
      "HydraPaw Water Bottle",
      "NightWalk Reflective Collar",
      "PurrHouse Litter Scoop",
    ],
    priceRange: [10, 120],
  },
  blazetech: {
    category: "Electronics",
    iconPool: ["laptop", "headphones", "keyboard", "mouse", "harddisk"],
    bases: [
      "BlazeCore Wireless Earbuds",
      "BlazeCore Gaming Mouse",
      "BlazeCore Mechanical Keyboard",
      "BlazeCore USB-C Hub",
      "BlazeCore Portable SSD",
      "BlazeCore Smartwatch",
      "BlazeCore Bluetooth Speaker",
      "BlazeCore Webcam Pro",
      "BlazeCore Power Adapter",
      "BlazeCore Display Dock",
      "BlazeCore Phone Stand",
      "BlazeCore Charging Cable",
      "BlazeCore Router Mini",
      "BlazeCore Mic Kit",
      "BlazeCore Keyboard Wrist Rest",
    ],
    priceRange: [20, 260],
  },
  fairbeautyproducts: {
    category: "Beauty",
    iconPool: ["lipstick", "spray", "lotion", "bottle-tonic-plus", "brush"],
    bases: [
      "FairGlow Face Cream",
      "FairGlow Vitamin Serum",
      "FairGlow Body Lotion",
      "FairGlow SPF Shield",
      "FairGlow Lip Balm Duo",
      "FairGlow Hair Repair Mask",
      "FairGlow Makeup Brush Kit",
      "FairGlow Cleanser Foam",
      "FairGlow Toner Mist",
      "FairGlow Night Gel",
      "FairGlow Eye Cream",
      "FairGlow Gentle Scrub",
      "FairGlow Glow Primer",
      "FairGlow Silk Foundation",
      "FairGlow Matte Compact",
    ],
    priceRange: [12, 95],
  },
};

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randPrice(min, max) {
  const cents = randInt(min * 100, max * 100);
  return Number((cents / 100).toFixed(2));
}

function sample(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function twoSentenceDescription(category, name) {
  return `${name} is designed for dependable daily use in ${category.toLowerCase()} needs. It combines practical quality with comfort so customers can rely on it long term.`;
}

async function getTargetMerchants(db) {
  const usersSnap = await db.collection("users").where("role", "==", "merchant").get();
  const byUsername = new Map();
  usersSnap.docs.forEach((d) => {
    const data = d.data() || {};
    const username = String(data.username || "").trim().toLowerCase();
    if (username) {
      byUsername.set(username, { id: d.id, ...data });
    }
  });

  const missing = TARGET_MERCHANTS.filter((u) => !byUsername.has(u));
  if (missing.length) {
    throw new Error(`Missing merchant users: ${missing.join(", ")}`);
  }

  return TARGET_MERCHANTS.map((u) => ({
    username: u,
    merchantId: byUsername.get(u).id,
  }));
}

async function getStoresByMerchant(db, targetMerchants) {
  const storesSnap = await db.collection("stores").get();
  const wantedMerchantIds = new Set(targetMerchants.map((m) => m.merchantId));
  const byMerchantId = new Map(targetMerchants.map((m) => [m.merchantId, []]));

  storesSnap.docs.forEach((d) => {
    const data = d.data() || {};
    if (!wantedMerchantIds.has(data.merchantId)) return;
    byMerchantId.get(data.merchantId).push({
      id: d.id,
      name: data.name || "Store",
      merchantId: data.merchantId,
    });
  });

  const merchantsWithoutStores = targetMerchants.filter(
    (m) => (byMerchantId.get(m.merchantId) || []).length === 0,
  );
  if (merchantsWithoutStores.length) {
    throw new Error(
      `No stores found for: ${merchantsWithoutStores.map((m) => m.username).join(", ")}`,
    );
  }

  return byMerchantId;
}

async function run() {
  const db = getDb();
  const admin = getAdmin();

  const targetMerchants = await getTargetMerchants(db);
  const storesByMerchant = await getStoresByMerchant(db, targetMerchants);

  const existingSnap = await db.collection("products").get();
  const usedNames = new Set(
    existingSnap.docs.map((d) => normalizeName((d.data() || {}).name)),
  );

  const plan = [];
  // 10 per merchant -> total 50
  for (const merchant of targetMerchants) {
    for (let i = 0; i < 10; i += 1) {
      plan.push(merchant);
    }
  }

  // Shuffle for better spread across merchants/stores
  plan.sort(() => Math.random() - 0.5);

  const created = [];
  const nameCursor = new Map();
  const storeCursor = new Map();

  for (const merchant of plan) {
    const def = CATALOG[merchant.username];
    const stores = storesByMerchant.get(merchant.merchantId) || [];

    let cursor = nameCursor.get(merchant.username) || 0;
    let nameCandidate = null;
    let normalized = null;

    while (cursor < def.bases.length) {
      const tryName = def.bases[cursor];
      const tryNorm = normalizeName(tryName);
      cursor += 1;
      if (!usedNames.has(tryNorm)) {
        nameCandidate = tryName;
        normalized = tryNorm;
        break;
      }
    }

    // If base names are exhausted, create unique variant names.
    if (!nameCandidate) {
      let suffixTry = 1;
      while (!nameCandidate && suffixTry <= 500) {
        const tryName = `${sample(def.bases)} ${["Prime", "Core", "Plus", "Max", "Elite"][suffixTry % 5]} ${suffixTry}`;
        const tryNorm = normalizeName(tryName);
        if (!usedNames.has(tryNorm)) {
          nameCandidate = tryName;
          normalized = tryNorm;
          break;
        }
        suffixTry += 1;
      }
    }

    if (!nameCandidate) {
      throw new Error(`Could not generate unique name for ${merchant.username}`);
    }

    nameCursor.set(merchant.username, cursor);
    usedNames.add(normalized);

    const sc = storeCursor.get(merchant.merchantId) || 0;
    const store = stores[sc % stores.length];
    storeCursor.set(merchant.merchantId, sc + 1);

    const price = randPrice(def.priceRange[0], def.priceRange[1]);
    const quantity = randInt(10, 100);
    const iconName = sample(def.iconPool);
    const description = twoSentenceDescription(def.category, nameCandidate);

    const payload = {
      category: def.category,
      createdAt: admin.firestore.Timestamp.now(),
      description,
      iconName,
      merchantId: merchant.merchantId,
      name: nameCandidate,
      price,
      quantity,
      storeId: store.id,
    };

    const ref = await db.collection("products").add(payload);
    created.push({
      id: ref.id,
      name: payload.name,
      merchant: merchant.username,
      storeId: payload.storeId,
      category: payload.category,
    });
  }

  console.log("Seeded products successfully.");
  console.log(`Created: ${created.length}`);
  const byMerchant = created.reduce((acc, p) => {
    acc[p.merchant] = (acc[p.merchant] || 0) + 1;
    return acc;
  }, {});
  console.log("By merchant:", byMerchant);
}

run().catch((err) => {
  console.error("Failed to seed 50 unique products:", err.message);
  process.exit(1);
});

