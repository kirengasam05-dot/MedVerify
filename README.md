# MedVerify Dashboard
React + TypeScript + Tailwind CSS + Firebase Firestore.

## Run
1. `npm install`
2. Firebase Console → create project → add a Web app → Build → Firestore Database → Create (test mode).
3. Copy `.env.example` to `.env` and paste your Firebase web config values.
4. `npm run dev` → open http://localhost:5173
5. Registry tab → "Load demo data", then scan barcode `6001234500011` on the Scan page.

## Firestore data
- `products/{barcode}`: name, category, manufacturer, batch, expiry, status (valid | flagged)
- `scans/{auto-id}`: barcode, productName, codeMatch, similarity (0-100), category, location, device, caseStatus, createdAt (ms)

Your ESP32 can add documents to `scans` (Firestore REST API) with the same fields and they appear live.

## Rules (development only)
rules_version = '2'; service cloud.firestore { match /databases/{d}/documents { match /{document=**} { allow read, write: if true; } } }
Add Firebase Authentication before real use.
