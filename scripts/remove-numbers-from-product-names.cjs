const { getDb } = require("./_firebase-node.cjs");

function stripNumbers(name) {
  const next = String(name || "")
    .replace(/\s*\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return next;
}

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
  };
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

async function run() {
  const { apply } = parseArgs(process.argv.slice(2));
  const db = getDb();
  const snap = await db.collection("products").get();

  let scanned = 0;
  let skippedNonString = 0;
  let unchanged = 0;
  const updates = [];

  for (const d of snap.docs) {
    scanned += 1;
    const data = d.data() || {};
    const current = data.name;

    if (typeof current !== "string") {
      skippedNonString += 1;
      continue;
    }

    const next = stripNumbers(current);
    if (!next || next === current) {
      unchanged += 1;
      continue;
    }

    updates.push({
      ref: db.collection("products").doc(d.id),
      current,
      next,
    });
  }

  console.log("Product trailing-number cleanup plan:");
  console.log(`Scanned: ${scanned}`);
  console.log(`Will update: ${updates.length}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Skipped (non-string names): ${skippedNonString}`);

  if (updates.length > 0) {
    console.log("Sample renames:");
    updates.slice(0, 10).forEach((u) => {
      console.log(`- "${u.current}" -> "${u.next}"`);
    });
  }

  if (!apply) {
    console.log("");
    console.log("Dry run only. No writes were committed.");
    console.log("Re-run with --apply to commit changes.");
    return;
  }

  let updated = 0;
  const groups = chunk(updates, 450);
  for (const [index, group] of groups.entries()) {
    const batch = db.batch();
    group.forEach((u) => batch.update(u.ref, { name: u.next }));
    await batch.commit();
    updated += group.length;
    console.log(`Committed batch ${index + 1}/${groups.length} (${group.length} writes)`);
  }

  console.log("");
  console.log("Product name cleanup complete.");
  console.log(`Updated: ${updated}`);
}

run().catch((err) => {
  console.error("Failed to remove trailing numbers from product names:", err.message);
  process.exit(1);
});
