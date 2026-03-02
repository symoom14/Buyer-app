#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required but not found. Install Node.js first."
  exit 1
fi

if ! command -v open >/dev/null 2>&1; then
  echo "This script is for macOS (open command not found)."
  exit 1
fi

if ! node -e '
const fs = require("fs");
const cfg = JSON.parse(fs.readFileSync("app.json", "utf8"));
const id = cfg?.expo?.ios?.bundleIdentifier;
if (!id || typeof id !== "string" || !id.trim()) process.exit(1);
' >/dev/null 2>&1; then
  cat <<'MSG'
Missing iOS bundle identifier in app.json.
Add this first:
  "ios": {
    "supportsTablet": true,
    "bundleIdentifier": "com.yourname.buyerapp"
  }
MSG
  exit 1
fi

echo "Generating/updating native iOS project..."
npx expo prebuild -p ios --no-install

if command -v pod >/dev/null 2>&1; then
  echo "Installing CocoaPods dependencies..."
  (
    cd ios
    pod install --ansi
  ) || echo "Warning: pod install failed. Open the project in Xcode and resolve CocoaPods setup."
else
  echo "Warning: CocoaPods (pod) is not installed. Install it with Homebrew: brew install cocoapods"
fi

WORKSPACE="$(find ios -maxdepth 2 -name "*.xcworkspace" ! -path "*/project.xcworkspace" | head -n 1)"
PROJECT="$(find ios -maxdepth 2 -name "*.xcodeproj" | head -n 1)"

if [[ -n "$WORKSPACE" ]]; then
  echo "Opening $WORKSPACE in Xcode..."
  open -a Xcode "$WORKSPACE"
elif [[ -n "$PROJECT" ]]; then
  echo "No CocoaPods workspace found; opening $PROJECT in Xcode instead..."
  open -a Xcode "$PROJECT"
else
  echo "No .xcworkspace or .xcodeproj found under ios/. Prebuild may have failed."
  exit 1
fi

cat <<'MSG'
Next in Xcode:
1) Select your iPhone as destination.
2) Press Run to reinstall.
MSG
