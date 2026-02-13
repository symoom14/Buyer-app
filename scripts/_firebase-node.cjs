const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function assertEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing required env var: ${name}`);
  }
}

function getServiceAccountPath() {
  loadEnvFile();
  assertEnv("FIREBASE_SERVICE_ACCOUNT_PATH");

  const rawPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const resolvedPath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), rawPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Service account file not found at: ${resolvedPath}. Check FIREBASE_SERVICE_ACCOUNT_PATH in .env`,
    );
  }

  return resolvedPath;
}

function initAdmin() {
  if (admin.apps.length) return admin.app();

  const serviceAccountPath = getServiceAccountPath();
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

function getDb() {
  initAdmin();
  return admin.firestore();
}

function getAdmin() {
  initAdmin();
  return admin;
}

module.exports = {
  getDb,
  getAdmin,
};

