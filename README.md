# MedVerify Dashboard
React + TypeScript + Tailwind CSS + Firebase Realtime Database.

## Run
1. `npm install`
2. Firebase Console → create project → add a Web app → Build → Realtime Database → Create.
3. Copy `.env.example` to `.env` and paste your Firebase web config values. Set `VITE_FIREBASE_DATABASE_URL` to the URL shown for your Realtime Database.
4. `npm run dev` → open http://localhost:5173
5. Registry tab → "Load demo data", then scan barcode `6001234500011` on the Scan page.

## Realtime Database data
- `/products/{barcode}`: name, category, manufacturer, expiry, piecesPerPack, status (valid | flagged)
- `/scans/{auto-id}`: barcode, product details copied from the registry, registryStatus, codeMatch, similarity (0-100), category, location, device, caseStatus, createdAt (ms)

Your ESP32 can add records under `/scans` in Realtime Database with the same fields and they appear live.

Configure Realtime Database rules to allow the app and scanner to read and write `/scans` and `/products`. The dashboard displays the latest 300 scan records.
