# Buddy Share

A college-exclusive peer-to-peer rental app for **Cambridge Institute of Technology**. Students sign in with their **@cambridge.edu.in email**, post what they need on **Ask me up**, get hourly quotes from classmates, accept one, and settle a **50% advance / 50% after return** payment — all inside the app.

Android app built with **Expo (React Native)**. The delivered APK is **standalone**: the backend runs inside the app, data is saved on the phone, and simulated Cambridge classmates make the full flow work with **no server, computer or Wi‑Fi**. A separate Node/Express + WebSocket server is included as an optional server-backed mode for real multi-device use. Money is a **sandbox INR wallet** (no real transactions).

---

## 1. What's built

| Feature | Status |
|---|---|
| College-email OTP login (domain allowlist) | ✅ |
| Same-college isolation (only classmates see your posts) | ✅ |
| "Ask me up" request composer (item, category, duration, note) | ✅ |
| Live feed with offer counts and filters | ✅ |
| Real-time broadcast of new requests to the whole college | ✅ |
| Owner quotes a price per hour + message | ✅ |
| Requester compares and accepts an offer | ✅ |
| 50% advance held in escrow, 50% on return, full payout to owner | ✅ |
| Wallet, top-ups, transaction ledger, cancellation/refund | ✅ |
| In-app notification center + local notifications + optional Expo push | ✅ |
| Sandbox payment flow (no real money, no KYC) | ✅ |
| Standalone APK — on-device backend + persistence + simulated peers | ✅ |
| Reset demo data from Profile | ✅ |

---

## 2. APK (ready to install)

**`BuddyShare-v1.0.0-release.apk`** is at the project root — a signed release build (65 MB, `com.buddyshare.app`, Android 7+ / minSdk 24). Copy it to your phone and install it; Android may ask to allow "install unknown apps".

- SHA-256: `6ff8b0e2e882727641f57ff12bfa84d4e0535327316d2c1a66a5e2a6cec83613`
- **No setup needed.** Install it, open it, sign up with any `@cambridge.edu.in` address, and everything runs on the phone. No computer, no Wi‑Fi, no server URL.
- Data (requests, offers, rentals, wallet, notifications) persists across restarts. **Profile → Reset demo data** wipes activity but keeps your account.
- Built-in Cambridge students (Rohan, Ananya, Vikram) automatically quote on your requests, pay, and confirm returns after a few seconds so you can experience every step. You can also quote on *their* requests.
- Unsigned-for-debug variant also available at `app/android/app/build/outputs/apk/debug/app-debug.apk`.

To rebuild after code changes:
```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd app/android && ./gradlew assembleRelease
cp app/build/outputs/apk/release/app-release.apk ../../BuddyShare-v1.0.0-release.apk
```
The signing keystore is `app/android/app/buddy-share.keystore` (password `buddy1234`). **Back it up** — you need the same key to publish updates. To keep signing config across a fresh `expo prebuild`, re-apply the `signingConfigs.release` block in `app/android/app/build.gradle` and the four `BUDDY_RELEASE_*` values in `app/android/gradle.properties`.

---

## 3. Try the full flow on the APK

1. Sign up as `you@cambridge.edu.in` — the sandbox OTP appears on screen; tap it to autofill. Only `@cambridge.edu.in` addresses are accepted.
2. In **Ask** post e.g. "Camera" for 2 hours. Within a few seconds two Cambridge students quote a price — you'll see a toast and a notification badge.
3. Open your request, compare the hourly quotes, and **Accept this offer**.
4. In **Wallet** tap **+₹500** to add sandbox money.
5. In **Rentals** open the rental → **Pay ₹X advance (50%)**. The amount is held in escrow.
6. Tap **Return & pay ₹X**. The simulated owner confirms the return a few seconds later.
7. The rental shows **Completed** and the full rent is released. Repeat with Rohan's or Ananya's requests to try the *owner* side.

---

### Optional: server-backed mode (real multi-device)

The standalone APK ignores the server. To use the included Node backend for genuine cross-phone sync, set `IS_LOCAL_MODE = false` in `app/src/api.ts` and rebuild, then:

```bash
# Terminal 1
cd server && npm install && npm start
# Terminal 2
cd app && npm install && npx expo start
```

Scan the QR in Expo Go on the same Wi‑Fi. The server prints its LAN IP; if it isn't `192.168.0.5`, open **Profile → Server URL** and set `http://YOUR-IP:3000/api`. With this mode, sign up on two phones with different `@cambridge.edu.in` addresses and the requests, quotes and notifications sync live between them.

---

## 4. Project layout

```
server/
  src/config.js      college-domain allowlist, env config
  src/store.js       JSON-file persistence
  src/auth.js        OTP, sessions, domain validation
  src/payments.js    wallet ledger, escrow hold/release/refund
  src/realtime.js    WebSocket hub, notifications, Expo push hook
  src/routes.js      REST API
  src/index.js       server bootstrap
  data/db.json       local dev database (created on first run)

app/
  App.tsx            root, tab bar, overlays
  src/api.ts         REST + WebSocket helpers, IS_LOCAL_MODE switch
  src/local-api.ts   on-device backend: routes, wallet ledger, simulated peers
  src/errors.ts      shared ApiError
  src/app-context.tsx auth, data, realtime, navigation, actions
  src/theme.ts, ui.tsx, types.ts
  screens/           Ask, Requests, Rentals, Wallet, Profile, details, notifications, help
```

### API endpoints (all under `/api`)
`POST /auth/request-otp`, `POST /auth/verify-otp`, `GET /me`, `POST /auth/logout`,
`GET/POST /requests`, `GET /requests/:id`, `POST /requests/:id/offers`, `POST /requests/:id/cancel`,
`POST /offers/:id/accept`, `GET /rentals`, `GET /rentals/:id`, `POST /rentals/:id/pay-advance`,
`POST /rentals/:id/pay-balance`, `POST /rentals/:id/confirm-return`, `POST /rentals/:id/cancel`,
`GET /wallet`, `POST /wallet/topup`, `GET /notifications`, `POST /notifications/read`,
`POST /notifications/push-token`, `GET /config`, `GET /health`, and WebSocket `/ws`.

---

## 5. Going to production with real money

The sandbox is intentional. To accept real payments in India you need:

1. **Payment gateway with marketplace/split payouts** — RazorpayX + linked accounts, or Stripe Connect. A plain "charge a card" integration cannot legally pay Person B.
2. **KYC of every lender** (PAN/Aadhaar, bank account) before they can receive money.
3. **Escrow semantics** — the current ledger already models hold → release → refund; swap `payments.js` for gateway orders/webhooks while keeping the same rental state machine.
4. **App-store review** + a privacy policy, refund/dispute policy, and terms.
5. **Background push** — add your EAS `projectId` to `app.json` (`extra.eas.projectId`) and set `EXPO_ACCESS_TOKEN` on the server. In-app realtime notifications already work without this.

---

## 6. Notes / limits

- Money is stored as integer **paise** to avoid rounding errors.
- The database is a local JSON file — fine for a prototype, replace with Postgres for multi-device production.
- "Zero latency" here means instant WebSocket delivery; real payment confirmation depends on the gateway (typically seconds, plus webhook latency).
- Trust/safety (damage, no-shows, disputes) needs a report/dispute flow and human moderation — not solved by code alone.
