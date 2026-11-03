# 0003. ALLOWED_ORIGIN is the Pages URL Cloudflare assigned

- Status: accepted
- Date: 2026-11-03

## Context

The notification worker only accepts requests whose `Origin` equals
`ALLOWED_ORIGIN` (the PWA's production URL). It had been set to
`https://workout-tracker.pages.dev`, guessing that the `workout-tracker` Pages
project would get that subdomain.

`*.pages.dev` subdomains are unique across all Cloudflare accounts. When the
project was created, `workout-tracker.pages.dev` already belonged to someone
else, so Cloudflare assigned `workout-tracker-2nf.pages.dev`. Deleting and
recreating the project gave the same suffix. With the old value, every request
from the deployed PWA gets a 403 and no rest-timer push can be scheduled.

## Decision

`ALLOWED_ORIGIN` is `https://workout-tracker-2nf.pages.dev`, the production
URL Cloudflare assigned to the project.

- It is a single exact origin. No wildcard, no `*.pages.dev`, no preview
  deployments (which have other hostnames and so still cannot schedule pushes).
- The worker code is unchanged. The push-host allowlist and VAPID keys are
  untouched.

## Consequences

- The value must be re-checked whenever the Pages project is deleted and
  recreated, or a custom domain is attached; the assigned suffix is not stable
  across projects.
- The worker is not deployed from CI, so this takes effect only after the
  maintainer runs `pnpm deploy:push`.
- The old value named an origin controlled by a third party. Replacing it also
  removes the chance that site could call the worker from a browser.
- `Origin` is not authentication: non-browser clients can send any header.
  That limit is unchanged and accepted for the MVP.
