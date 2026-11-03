# 0004. The VAPID public key and contact live in wrangler.jsonc

- Status: accepted
- Date: 2026-11-03

## Context

`wrangler.jsonc` shipped `VAPID_PUBLIC_KEY: ""` and a placeholder
`VAPID_SUBJECT`, to be filled in per deployment. The live worker was fixed by
editing those two variables in the Cloudflare dashboard. But `wrangler deploy`
writes the `vars` in the config over the dashboard values, so the next
`pnpm deploy:push` would have reset them: an empty public key breaks the push
signature and Apple rejects a placeholder contact.

## Decision

- `VAPID_PUBLIC_KEY` is committed in `worker/wrangler.jsonc`, with the same
  value as the `VITE_VAPID_PUBLIC_KEY` repo variable. A public key is public by
  design: the app ships it to every browser.
- `VAPID_SUBJECT` is an https URL (the repository), not a `mailto:` address.
  RFC 8292 allows either, and the repository is public, so a personal email
  would be published for good.
- `VAPID_PRIVATE_JWK` stays a secret set with `wrangler secret put`, never in
  the repository. `ALLOWED_ORIGIN` and the push-host allowlist are unchanged.

## Consequences

- The config is the source of truth: dashboard edits to these variables are
  lost on the next deploy, so change them here.
- Rotating the key pair means updating this file, the `VITE_VAPID_PUBLIC_KEY`
  variable and the `VAPID_PRIVATE_JWK` secret together, then redeploying the
  worker and the app. Phones must re-subscribe.
- The https subject has not been exercised against Apple's push service yet.
  Verify with a real push after the first `pnpm deploy:push`; if Apple rejects
  it, switch to a `mailto:` address.
