const { getAdmin, getDb } = require("./_firebase-node.cjs");

const CATALOG = {
  Electronics: [
    { name: "Wireless Mouse", iconName: "mouse", min: 15, max: 45, description: "Ergonomic wireless mouse with silent click buttons." },
    { name: "Bluetooth Speaker", iconName: "speaker-wireless", min: 35, max: 120, description: "Portable speaker with punchy bass and long battery life." },
    { name: "Mechanical Keyboard", iconName: "keyboard", min: 65, max: 180, description: "Tactile mechanical keyboard ideal for work and gaming." },
    { name: "Noise Cancelling Headphones", iconName: "headphones", min: 90, max: 320, description: "Over-ear headphones with adaptive active noise cancellation." },
    { name: "USB-C Charger", iconName: "power-plug", min: 18, max: 60, description: "Fast charger compatible with phones, tablets, and laptops." },
  ],
  Home: [
    { name: "Ceramic Mug Set", iconName: "cup", min: 16, max: 45, description: "Set of ceramic mugs with matte glaze and easy-grip handles." },
    { name: "Floor Lamp", iconName: "floor-lamp", min: 45, max: 160, description: "Slim floor lamp with warm LED light and modern design." },
    { name: "Storage Basket", iconName: "basket", min: 12, max: 40, description: "Woven storage basket for organizing shelves and closets." },
    { name: "Wall Clock", iconName: "clock-outline", min: 22, max: 75, description: "Minimal wall clock with silent sweep movement." },
    { name: "Throw Pillow", iconName: "sofa", min: 14, max: 38, description: "Soft decorative throw pillow with removable washable cover." },
  ],
  Grocery: [
    { name: "Organic Coffee Beans", iconName: "coffee", min: 12, max: 28, description: "Medium roast arabica beans with rich chocolate notes." },
    { name: "Premium Olive Oil", iconName: "bottle-tonic", min: 10, max: 30, description: "Cold-pressed extra virgin olive oil for everyday cooking." },
    { name: "Trail Mix Pack", iconName: "food-apple", min: 8, max: 18, description: "Nuts and dried fruit blend for convenient snacking." },
    { name: "Wholegrain Pasta", iconName: "noodles", min: 4, max: 11, description: "Nutritious wholegrain pasta with great texture." },
    { name: "Dark Chocolate Bar", iconName: "candy", min: 3, max: 10, description: "Smooth 70% cocoa chocolate bar with deep flavor." },
  ],
  Fashion: [
    { name: "Classic Hoodie", iconName: "hanger", min: 28, max: 80, description: "Comfort-fit hoodie made with soft brushed fleece." },
    { name: "Running Shoes", iconName: "shoe-sneaker", min: 55, max: 170, description: "Lightweight running shoes with cushioned sole." },
    { name: "Leather Belt", iconName: "belt", min: 20, max: 70, description: "Durable leather belt with brushed metal buckle." },
    { name: "Cotton T-Shirt", iconName: "tshirt-crew", min: 10, max: 32, description: "Breathable cotton t-shirt in everyday colors." },
    { name: "Travel Backpack", iconName: "bag-personal", min: 35, max: 120, description: "Multi-compartment backpack with laptop sleeve." },
  ],
  Beauty: [
    { name: "Hydrating Face Cream", iconName: "face-man-shimmer", min: 14, max: 45, description: "Daily moisturizer with hyaluronic acid and ceramides." },
    { name: "Vitamin C Serum", iconName: "bottle-soda-classic", min: 18, max: 55, description: "Brightening serum to improve skin radiance." },
    { name: "Shampoo Bar", iconName: "shower", min: 9, max: 24, description: "Sulfate-free shampoo bar with fresh botanical scent." },
    { name: "Body Lotion", iconName: "lotion", min: 12, max: 32, description: "Lightweight lotion for long-lasting hydration." },
    { name: "Lip Balm Duo", iconName: "lipstick", min: 7, max: 18, description: "Moisturizing lip balm duo with natural oils." },
  ],
  Sports: [
    { name: "Yoga Mat", iconName: "yoga", min: 22, max: 65, description: "Non-slip yoga mat with extra joint support." },
    { name: "Resistance Bands", iconName: "dumbbell", min: 14, max: 38, description: "Set of resistance bands for full-body training." },
    { name: "Insulated Water Bottle", iconName: "water", min: 18, max: 45, description: "Double-wall insulated bottle that keeps drinks cold." },
    { name: "Fitness Tracker Band", iconName: "watch-variant", min: 40, max: 150, description: "Track activity, heart rate, and daily performance." },
    { name: "Skipping Rope", iconName: "jump-rope", min: 8, max: 20, description: "Adjustable speed rope for cardio workouts." },
  ],
  Toys: [
    { name: "Building Block Set", iconName: "toy-brick", min: 25, max: 90, description: "Creative block set for kids and hobby builders." },
    { name: "Remote Car", iconName: "car-sports", min: 30, max: 140, description: "Fast remote-controlled car with rechargeable battery." },
    { name: "Art Supply Kit", iconName: "palette", min: 18, max: 55, description: "Comprehensive art kit with pencils, paints, and brushes." },
    { name: "Puzzle Box", iconName: "puzzle", min: 12, max: 35, description: "Challenging puzzle set for all skill levels." },
    { name: "Plush Toy", iconName: "teddy-bear", min: 10, max: 28, description: "Soft plush toy with premium stitching." },
  ],
  Office: [
    { name: "Desk Organizer", iconName: "desk", min: 15, max: 48, description: "Compact organizer for pens, notes, and accessories." },
    { name: "Notebook Bundle", iconName: "notebook", min: 9, max: 26, description: "Set of durable notebooks for study and planning." },
    { name: "Wireless Presenter", iconName: "presentation", min: 20, max: 70, description: "USB presenter with laser pointer and smooth controls." },
    { name: "Ergonomic Chair Cushion", iconName: "chair-rolling", min: 24, max: 65, description: "Memory foam cushion for improved sitting comfort." },
    { name: "Portable SSD", iconName: "harddisk", min: 55, max: 210, description: "High-speed portable SSD for backups and media files." },
  ],
  "Pet Supplies": [
    { name: "Pet Food Bowl", iconName: "bowl", min: 12, max: 34, description: "Stainless steel bowl with anti-slip base." },
    { name: "Dog Leash", iconName: "dog-side", min: 14, max: 40, description: "Comfort-grip leash for daily walks." },
    { name: "Cat Scratcher", iconName: "cat", min: 16, max: 55, description: "Durable scratching board for cats." },
    { name: "Pet Grooming Brush", iconName: "brush", min: 10, max: 28, description: "Gentle grooming brush for shedding control." },
    { name: "Pet Carrier Bag", iconName: "bag-suitcase", min: 30, max: 95, description: "Ventilated carrier bag for safe travel." },
  ],
  Automotive: [
    { name: "Car Phone Mount", iconName: "cellphone-link", min: 12, max: 35, description: "Dashboard mount with secure grip and rotation." },
    { name: "Portable Tire Inflator", iconName: "car-tire-alert", min: 35, max: 110, description: "Compact air inflator with digital pressure readout." },
    { name: "Car Vacuum Cleaner", iconName: "car-wash", min: 28, max: 85, description: "Portable vacuum for quick interior cleaning." },
    { name: "Dash Camera", iconName: "camera-front-variant", min: 60, max: 220, description: "Wide-angle dash cam with night recording." },
    { name: "Windshield Sun Shade", iconName: "weather-sunny", min: 10, max: 25, description: "Foldable sun shade for heat and UV protection." },
  ],
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPrice(min, max) {
  const cents = randInt(min * 100, max * 100);
  return Number((cents / 100).toFixed(2));
}

function sample(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function getBalancedCategories(total) {
  const categories = Object.keys(CATALOG);
  const result = [];
  while (result.length < total) {
    const shuffled = [...categories].sort(() => Math.random() - 0.5);
    for (const c of shuffled) {
      if (result.length >= total) break;
      result.push(c);
    }
  }
  return result.slice(0, total);
}

async function fetchMerchantStorePairs(db) {
  const merchantsSnap = await db.collection("users").where("role", "==", "merchant").get();
  const merchantIds = new Set(merchantsSnap.docs.map((d) => d.id));

  const storesSnap = await db.collection("stores").get();
  const stores = storesSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((s) => s.merchantId && merchantIds.has(s.merchantId));

  return stores.map((s) => ({
    merchantId: s.merchantId,
    storeId: s.id,
    storeName: s.name || "Store",
  }));
}

async function run() {
  const db = getDb();
  const admin = getAdmin();
  const pairs = await fetchMerchantStorePairs(db);
  if (!pairs.length) {
    throw new Error("No valid merchant/store pairs found. Seed stores first.");
  }

  const categories = getBalancedCategories(50);
  const created = [];

  for (let i = 0; i < 50; i += 1) {
    const category = categories[i];
    const template = sample(CATALOG[category]);
    const pair = sample(pairs);
    const price = randomPrice(template.min, template.max);
    const quantity = randInt(10, 100);

    const payload = {
      category,
      createdAt: admin.firestore.Timestamp.now(),
      description: template.description,
      iconName: template.iconName,
      merchantId: pair.merchantId,
      name: `${template.name} ${i + 1}`,
      price,
      quantity,
      storeId: pair.storeId,
    };

    const ref = await db.collection("products").add(payload);
    created.push({
      id: ref.id,
      name: payload.name,
      category: payload.category,
      merchantId: payload.merchantId,
      storeId: payload.storeId,
      price: payload.price,
      quantity: payload.quantity,
    });
  }

  console.log(`Inserted ${created.length} products.`);
  const categoryCounts = created.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  console.log("Category distribution:", categoryCounts);
  console.log("Sample inserted IDs:", created.slice(0, 5).map((p) => p.id));
}

run().catch((err) => {
  console.error("Failed to seed dummy products:", err.message);
  process.exit(1);
});
