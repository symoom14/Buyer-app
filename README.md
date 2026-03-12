# Buyer

Buyer is a multi-role mobile commerce app built with Expo + React Native + Firebase.
It supports three user roles in one codebase:

- Customer: browse products, order, pay, track status, view invoices, review products.
- Merchant: manage stores/products, fulfill orders, monitor sales and inventory.
- Admin: monitor platform metrics, users, stores, products, and order performance.

## Tech Stack

- Expo SDK 54 + React Native 0.81
- Expo Router (file-based routing)
- Firebase Auth + Firestore + Storage
- React Context for app state (auth, cart, favorites, theme preference)
- Lottie animations and WebView/PDF preview utilities

## Core Capabilities

- Role-based auth flow and routing (`customer`, `merchant`, `admin`)
- Product catalog with search, sorting, variants, and favorites
- Cart + checkout workflow
- Order lifecycle tracking (pending, accepted, completed, cancelled)
- Merchant inventory and restock workflows
- Admin dashboard with live operational metrics
- PDF generation/preview for order/invoice related screens
- Push-style in-app notifications model via Firestore collections

## Project Structure

- `app/`: route screens (Expo Router)
- `src/components/`: reusable UI components
- `src/context/`: global state providers
- `src/firebase/`: Firebase initialization/config
- `src/theme/`: theme system and status palettes
- `src/utils/`: domain utilities (sorting, variants, notifications, reviews)
- `scripts/`: maintenance, seeding, and data migration scripts
- `assets/`: fonts, images, and animations

## Prerequisites

- Node.js 18+
- npm 9+
- Expo CLI tooling via `npx expo ...`
- A Firebase project with Auth, Firestore, and Storage enabled

## Environment Variables

Create a `.env` file in the project root with:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

These are consumed by `src/firebase/firebaseConfig.js`.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the Expo dev server:

```bash
npm run start
```

3. Run on a target platform:

```bash
npm run android
npm run ios
npm run web
```

## Useful Scripts

- `npm run lint`: run Expo/ESLint checks
- `npm run ios:weekly`: iOS prebuild + CocoaPods + open Xcode workflow
- `npm run reset-project`: reset scaffold utility
- `npm run dev:seed-dummy-products`: seed test product data
- `npm run dev:seed-50-unique-products-target-merchants`: seed balanced merchant products
- `npm run dev:validate-product-store-categories`: validate category mapping consistency
- `npm run dev:export-admin-revenue-flow-audit`: export admin revenue flow audit JSON

Additional maintenance and migration scripts are available under `scripts/` and exposed in `package.json`.

## Routing Overview

- `app/(auth)/*`: login/signup
- `app/customer/*`: customer experience
- `app/merchant/*`: merchant dashboard and operations
- `app/admin/*`: admin control panel and analytics

## UI/UX Showcase

### Authentication

<img src="docs/media/Sign%20in.png" alt="Login screen" width="280" />

### Customer Experience

<img src="docs/media/Customer%20home.png" alt="Customer home" width="280" />
<img src="docs/media/Customer%20order%20flow.gif" alt="Checkout flow" width="280" />

### Merchant Experience

<img src="docs/media/Merchant%20home.png" alt="Merchant dashboard" width="280" />
<img src="docs/media/Merchant%20order%20processing%20flow.gif" alt="Order fulfillment flow" width="280" />

### Admin Experience

<img src="docs/media/Admin%20home.png" alt="Admin panel" width="280" />
<img src="docs/media/Admin%20analytics.gif" alt="Merchant performance analytics" width="280" />

## Notes for Contributors

- Keep new UI logic in reusable `src/components` where possible.
- Keep domain logic in `src/utils` and context providers in `src/context`.
- Use existing theme hooks (`useAppTheme`) instead of hardcoding colors.
- Prefer script-based data operations in `scripts/` for repeatable admin tasks.

## License

No license file is currently defined in this repository.
