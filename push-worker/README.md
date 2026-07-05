# maintenance-push (Cloudflare Worker)

Sends Web Push reminders to subscribed devices for [Maintenance Tracker](../).

## Design

Privacy-preserving: the push message carries **no vehicle data**. The Worker only
stores an anonymous push subscription and acts as a scheduled "nudge". When a push
arrives, the app's service worker reads the **on-device** due-list snapshot and
renders the reminder — so personal data never reaches this server.

- `POST /subscribe` — store a push subscription (idempotent, keyed by endpoint hash)
- `POST /unsubscribe` — remove a subscription
- `GET  /vapidPublicKey` — the public VAPID key
- `POST /test` — send a push to all subscriptions now (requires `X-Admin-Token`)
- Cron (`0 15 * * 1`, weekly) — nudge every subscribed device

## Deploy

```bash
npm install
npx wrangler kv namespace create SUBSCRIPTIONS   # put the id in wrangler.toml
npx wrangler deploy
# secrets (never commit these):
npx wrangler secret put VAPID_PRIVATE_KEY        # paste the VAPID private key
npx wrangler secret put ADMIN_TOKEN              # any random string; gates /test
```

Generate a VAPID key pair with `npx web-push generate-vapid-keys --json`. The
public key also goes in the app at `../src/pushConfig.ts`; the private key is a
Worker secret only.

Deployed at: `https://maintenance-push.enachealex1.workers.dev`
