# Workout Tracker

A personal workout log that replaces the Strong app. It runs as a PWA from the iPhone Home Screen, keeps every record on the device, and imports the existing Strong history.

- **Local-first**: records live in IndexedDB on the phone and work offline.
- **No accounts, no data on servers**: the only server is a tiny notification worker. It learns a push endpoint and a time, never workout data.
- **Free**: Cloudflare Pages for the app, a Cloudflare Worker for notifications, no Apple Developer Program.

Full plan (in Japanese): approach, data model, Strong import spec, milestones and risks are kept in the planning doc.

## Status: phase 1 — notification check

The app is currently a single test screen for the riskiest part of the plan: does a rest-timer notification reach the lock screen on time? Start a 90-second timer, lock the phone, and the screen records how late the push arrived. If pushes are unreliable, the plan falls back to a native Expo app.

## Stack

| Part          | Choice                                                                   |
| ------------- | ------------------------------------------------------------------------ |
| App           | Vite, React, TypeScript                                                  |
| PWA           | vite-plugin-pwa (`injectManifest`, custom service worker in `src/sw.ts`) |
| Storage       | IndexedDB via Dexie (`src/db`)                                           |
| Notifications | Cloudflare Worker + Durable Object alarm + Web Push (`worker/`)          |
| Tests         | Vitest                                                                   |
| Lint/format   | Biome                                                                    |

## How the rest-timer notification works

1. When a set is done, the app sends `{ endpoint, fireAt }` to the worker.
2. A Durable Object (one per device) stores it and sets an alarm for `fireAt`.
3. The alarm sends an empty Web Push signed with VAPID. No payload means no workout data leaves the phone and no payload encryption is needed.
4. The service worker shows "休憩終了" and records when the push arrived.

The worker only sends to known push services (Apple, Google, Mozilla, Microsoft) and only accepts requests from the app's origin. Timers must be 5 seconds to 1 hour away. A failed push is not retried, because a late notification is worse than none.

## Layout

```
src/
  App.tsx          phase-1 timer test screen
  sw.ts            service worker: offline cache, push, notification click
  db/              Dexie schema and types for the whole data model
  lib/push.ts      permission, subscription, worker calls
  lib/restTimer.ts timer status and countdown helpers
worker/
  src/index.ts     HTTP routes and the RestTimer Durable Object
  src/vapid.ts     VAPID JWT and push sending (WebCrypto only)
  src/validate.ts  request validation and push-host allowlist
```

## Development

```sh
pnpm install
pnpm dev          # app on http://localhost:5173
pnpm test         # app tests
pnpm --filter worker test
pnpm lint
pnpm typecheck
```

Personal data never goes in this repo (it is public). `*.csv` and `fixtures/private/` are git-ignored; keep the Strong export there for local import tests.

## Deploy and test on the iPhone

1. Generate VAPID keys:

   ```sh
   pnpm --filter worker vapid
   ```
2. In `worker/wrangler.jsonc`, set `VAPID_PUBLIC_KEY` to the public key and `VAPID_SUBJECT` to a real `mailto:` address (Apple rejects placeholders). Set `ALLOWED_ORIGIN` to the Pages URL (step 5).
3. Log in and store the private key as a secret:

   ```sh
   cd worker
   npx wrangler login
   npx wrangler secret put VAPID_PRIVATE_JWK   # paste the JSON from step 1
   ```
4. Deploy the worker and note its URL:

   ```sh
   pnpm deploy:push
   ```
5. Create `.env.local` in the repo root and deploy the app:

   ```sh
   VITE_VAPID_PUBLIC_KEY=<public key>
   VITE_PUSH_API_URL=https://workout-push.<account>.workers.dev
   ```

   ```sh
   pnpm deploy:app
   ```

   If the Pages URL differs from `ALLOWED_ORIGIN`, update it and run `pnpm deploy:push` again.
6. On the iPhone (iOS 16.4 or later): open the Pages URL in Safari, Share → Add to Home Screen, open the Home Screen icon, tap 通知を許可する, start a 90-second timer and lock the phone.

## License

MIT © 2025 Yuto
