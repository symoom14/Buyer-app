const { getAdmin, getDb } = require("./_firebase-node.cjs");

const ALL_MERCHANTS = [
  "hardwaremarks",
  "homelyliving",
  "pawspets",
  "merchtest",
  "merchant1",
  "blazetech",
  "fairbeautyproducts",
  "merchant2",
];

const PRODUCT_SEED_MERCHANTS = [
  "hardwaremarks",
  "homelyliving",
  "pawspets",
  "blazetech",
  "fairbeautyproducts",
];

const MERCHANT_ALIAS = {
  blazetect: "blazetech",
};

const STORE_NAMES_BY_MERCHANT = {
  hardwaremarks: ["Marks Hardware Hub", "Tool & Fix Depot", "BuildRight Supplies"],
  homelyliving: ["Homely Living Decor", "Cozy Nest Home", "Everyday Home Finds"],
  pawspets: ["Paws Pet Essentials", "Tail & Whisker Shop", "Happy Paws Care"],
  merchtest: ["Merch Test Central", "Merch Test Mart", "Merch Test Outlet"],
  merchant1: ["Merchant One General", "OneStop Everyday", "Merchant One Select"],
  blazetech: ["BlazeTech Devices", "BlazeTech Accessories", "BlazeTech Smart Gear"],
  fairbeautyproducts: ["Fair Beauty Studio", "Glow & Care Beauty", "Fair Beauty Essentials"],
  merchant2: ["Merchant Two General", "TwoTown Market", "Merchant Two Select"],
};

const PRODUCT_SET_BY_MERCHANT = {
  hardwaremarks: [
    {
      name: "Cordless Drill",
      category: "Hardware",
      description: "Compact cordless drill for daily repair and installation tasks.",
      iconName: "hammer-drill",
      price: 95,
    },
    {
      name: "Claw Hammer",
      category: "Hardware",
      description: "Balanced steel claw hammer for framing and finishing jobs.",
      iconName: "hammer",
      price: 30,
    },
    {
      name: "Adjustable Wrench",
      category: "Hardware",
      description: "Durable adjustable wrench with comfortable non-slip grip.",
      iconName: "wrench",
      price: 25,
    },
    {
      name: "Tape Measure 8m",
      category: "Hardware",
      description: "Shock-resistant tape measure with clear metric markings.",
      iconName: "tape-measure",
      price: 20,
    },
    {
      name: "Screwdriver Set",
      category: "Hardware",
      description: "Multi-head screwdriver set for precision and standard screws.",
      iconName: "screwdriver",
      price: 40,
    },
    {
      name: "Safety Gloves",
      category: "Hardware",
      description: "Protective work gloves for heavy-duty handling and repairs.",
      iconName: "gloves",
      price: 15,
    },
    {
      name: "Toolbox Organizer",
      category: "Hardware",
      description: "Portable toolbox with segmented compartments for hardware items.",
      iconName: "toolbox",
      price: 60,
    },
  ],
  homelyliving: [
    {
      name: "Ceramic Vase",
      category: "Home",
      description: "Matte ceramic vase to elevate shelves and tabletop styling.",
      iconName: "vase",
      price: 45,
    },
    {
      name: "Accent Cushion",
      category: "Home",
      description: "Soft accent cushion with textured cover for cozy interiors.",
      iconName: "sofa",
      price: 25,
    },
    {
      name: "Wall Frame Set",
      category: "Home",
      description: "Minimal wall frame set for gallery-style room decoration.",
      iconName: "image-frame",
      price: 35,
    },
    {
      name: "Scented Candle",
      category: "Home",
      description: "Long-burn scented candle for a warm and relaxing atmosphere.",
      iconName: "candle",
      price: 20,
    },
    {
      name: "Table Lamp",
      category: "Home",
      description: "Modern table lamp with soft warm light for bedside use.",
      iconName: "lamp",
      price: 55,
    },
    {
      name: "Storage Basket",
      category: "Home",
      description: "Woven basket for neat storage of home essentials.",
      iconName: "basket",
      price: 30,
    },
    {
      name: "Dining Runner",
      category: "Home",
      description: "Elegant dining table runner for daily and festive setup.",
      iconName: "table-furniture",
      price: 25,
    },
  ],
  pawspets: [
    {
      name: "Pet Bowl Set",
      category: "Pet Supplies",
      description: "Double stainless steel bowl set with anti-slip base.",
      iconName: "bowl",
      price: 25,
    },
    {
      name: "Dog Leash",
      category: "Pet Supplies",
      description: "Strong and comfortable leash for safe daily walks.",
      iconName: "dog-side",
      price: 20,
    },
    {
      name: "Cat Scratcher",
      category: "Pet Supplies",
      description: "Scratch pad designed to keep cats active and happy.",
      iconName: "cat",
      price: 35,
    },
    {
      name: "Pet Shampoo",
      category: "Pet Supplies",
      description: "Gentle pet shampoo suitable for frequent grooming routines.",
      iconName: "shower",
      price: 20,
    },
    {
      name: "Pet Bed",
      category: "Pet Supplies",
      description: "Soft plush bed for restful sleep for small to medium pets.",
      iconName: "bed",
      price: 60,
    },
    {
      name: "Chew Toy",
      category: "Pet Supplies",
      description: "Durable chew toy to support active play and engagement.",
      iconName: "toy-brick",
      price: 15,
    },
    {
      name: "Pet Carrier",
      category: "Pet Supplies",
      description: "Ventilated travel carrier for safe transport.",
      iconName: "bag-suitcase",
      price: 70,
    },
  ],
  blazetech: [
    {
      name: "Wireless Earbuds",
      category: "Electronics",
      description: "True wireless earbuds with clear audio and stable connectivity.",
      iconName: "earbuds",
      price: 85,
    },
    {
      name: "Gaming Mouse",
      category: "Electronics",
      description: "High-precision gaming mouse with customizable DPI.",
      iconName: "mouse",
      price: 45,
    },
    {
      name: "Mechanical Keyboard",
      category: "Electronics",
      description: "Responsive keyboard built for productivity and gaming.",
      iconName: "keyboard",
      price: 90,
    },
    {
      name: "USB-C Hub",
      category: "Electronics",
      description: "Multi-port USB-C hub for laptop and mobile workflows.",
      iconName: "hubspot",
      price: 55,
    },
    {
      name: "Bluetooth Speaker",
      category: "Electronics",
      description: "Portable speaker with rich sound and deep bass output.",
      iconName: "speaker-wireless",
      price: 80,
    },
    {
      name: "Smartwatch",
      category: "Electronics",
      description: "Feature-packed smartwatch for fitness and notifications.",
      iconName: "watch-variant",
      price: 120,
    },
    {
      name: "Portable SSD",
      category: "Electronics",
      description: "Fast and compact SSD for secure external storage.",
      iconName: "harddisk",
      price: 130,
    },
  ],
  fairbeautyproducts: [
    {
      name: "Hydrating Face Cream",
      category: "Beauty",
      description: "Nourishing face cream for daily hydration and skin balance.",
      iconName: "face-man-shimmer",
      price: 40,
    },
    {
      name: "Vitamin C Serum",
      category: "Beauty",
      description: "Brightening serum to improve overall skin glow.",
      iconName: "bottle-tonic-plus",
      price: 45,
    },
    {
      name: "Body Lotion",
      category: "Beauty",
      description: "Light lotion for long-lasting moisture and softness.",
      iconName: "lotion",
      price: 30,
    },
    {
      name: "Sunscreen SPF 50",
      category: "Beauty",
      description: "Daily SPF protection with non-greasy finish.",
      iconName: "weather-sunny-alert",
      price: 35,
    },
    {
      name: "Lip Balm Set",
      category: "Beauty",
      description: "Moisturizing lip balm duo with smooth finish.",
      iconName: "lipstick",
      price: 20,
    },
    {
      name: "Hair Repair Mask",
      category: "Beauty",
      description: "Deep conditioning mask for dry and damaged hair.",
      iconName: "hair-dryer",
      price: 35,
    },
    {
      name: "Makeup Brush Kit",
      category: "Beauty",
      description: "Essential makeup brush set for everyday application.",
      iconName: "brush",
      price: 50,
    },
  ],
};

function normalizeMerchantName(name) {
  const raw = String(name || "").trim().toLowerCase();
  return MERCHANT_ALIAS[raw] || raw;
}

function randomQty() {
  return Math.floor(Math.random() * (100 - 10 + 1)) + 10;
}

async function fetchMerchantUsers(db) {
  const snap = await db.collection("users").where("role", "==", "merchant").get();
  return snap.docs.map((d) => ({
    userId: d.id,
    ...(d.data() || {}),
  }));
}

async function ensureStoresForMerchant(db, merchantId, storeNames) {
  const existingSnap = await db
    .collection("stores")
    .where("merchantId", "==", merchantId)
    .get();

  const existingByName = new Map(
    existingSnap.docs.map((d) => [String(d.data()?.name || "").toLowerCase(), d.id]),
  );

  const storeIds = [];
  let created = 0;
  let reused = 0;

  for (const name of storeNames) {
    const key = name.toLowerCase();
    if (existingByName.has(key)) {
      storeIds.push(existingByName.get(key));
      reused += 1;
      continue;
    }
    const ref = await db.collection("stores").add({
      name,
      merchantId,
      createdAt: getAdmin().firestore.Timestamp.now(),
    });
    storeIds.push(ref.id);
    created += 1;
  }

  return { storeIds, created, reused };
}

async function seedProductsForStore(db, merchantId, storeId, templates) {
  const existingSnap = await db.collection("products").where("storeId", "==", storeId).get();
  const existingNames = new Set(
    existingSnap.docs.map((d) => String(d.data()?.name || "").toLowerCase()),
  );

  let created = 0;
  let skipped = 0;

  for (const t of templates) {
    if (existingNames.has(t.name.toLowerCase())) {
      skipped += 1;
      continue;
    }

    await db.collection("products").add({
      category: t.category,
      createdAt: getAdmin().firestore.Timestamp.now(),
      description: t.description,
      iconName: t.iconName,
      merchantId,
      name: t.name,
      price: t.price,
      quantity: randomQty(),
      storeId,
    });
    created += 1;
  }

  return { created, skipped };
}

async function run() {
  const db = getDb();

  const merchants = await fetchMerchantUsers(db);
  const merchantByUsername = new Map();
  for (const m of merchants) {
    const uname = normalizeMerchantName(m.username);
    if (uname) merchantByUsername.set(uname, m);
  }

  const results = {
    storesCreated: 0,
    storesReused: 0,
    productsCreated: 0,
    productsSkipped: 0,
    missingMerchants: [],
  };

  const seededStoreIdsByMerchant = {};

  for (const requestedName of ALL_MERCHANTS) {
    const normalized = normalizeMerchantName(requestedName);
    const merchant = merchantByUsername.get(normalized);
    if (!merchant) {
      results.missingMerchants.push(requestedName);
      continue;
    }

    const storeNames = STORE_NAMES_BY_MERCHANT[normalized] || [
      `${merchant.username} Store 1`,
      `${merchant.username} Store 2`,
      `${merchant.username} Store 3`,
    ];

    const storeRes = await ensureStoresForMerchant(db, merchant.userId, storeNames.slice(0, 3));
    seededStoreIdsByMerchant[normalized] = storeRes.storeIds;
    results.storesCreated += storeRes.created;
    results.storesReused += storeRes.reused;
  }

  for (const requestedName of PRODUCT_SEED_MERCHANTS) {
    const normalized = normalizeMerchantName(requestedName);
    const merchant = merchantByUsername.get(normalized);
    const templates = PRODUCT_SET_BY_MERCHANT[normalized];
    const storeIds = seededStoreIdsByMerchant[normalized] || [];

    if (!merchant || !templates || !storeIds.length) continue;

    for (const storeId of storeIds) {
      const prodRes = await seedProductsForStore(
        db,
        merchant.userId,
        storeId,
        templates,
      );
      results.productsCreated += prodRes.created;
      results.productsSkipped += prodRes.skipped;
    }
  }

  console.log("Store/product seeding complete.");
  console.log(JSON.stringify(results, null, 2));
}

run().catch((err) => {
  console.error("Failed to seed stores/products:", err.message);
  process.exit(1);
});

