# Review lenses — workout-tracker

Repo-specific lenses for `workflow:code-review-guideline`. Apply the ones that
materially overlap the diff. The shared skill owns the method; this file owns
only what is true of *this* codebase.

The app is local-first: records live in IndexedDB on the phone, and the only
server is the notification worker in `worker/`.

## What counts as Critical / Major here

| Tier | In this repo |
| --- | --- |
| **Critical** | Workout data (or anything beyond a push endpoint and a time) sent to the worker or any server. A worker change that accepts a request from an origin other than `ALLOWED_ORIGIN`, or pushes to a host outside the allowlist. A VAPID private key, or personal data such as the Strong export, committed to the repo. Editing an already-shipped Dexie `version(n)` block instead of adding a new one, or an upgrade that drops or rewrites stored records. |
| **Major** | A dependency pointing the wrong way (`src/lib` or `src/db` importing components; the service worker or `worker/` importing React). Persistence, network calls or business logic inside a presentational component. A new indexed field or store with no new Dexie version. Estimated-1RM or volume maths that loses precision through repeated float rounding of stored values. New runtime behavior with no test. |

## Architecture boundaries

The intended direction is in `AGENTS.md` § Project map: components render and
emit events, logic lives in `src/lib`, persistence in `src/db`.

- Flag dependencies pointing the wrong way, and `src/lib`, `src/db`, `src/sw.ts`
  or `worker/` code that imports React or touches the DOM.
- Flag data fetching, IndexedDB access or business logic inside a component
  that should only render props and emit events.
- `App.tsx` is a phase-1 shortcut that still mixes these. Do not report the
  existing mix again; report new code that deepens it.
- Do not report a "missing layer" as a finding; report code that *breaks* the
  intended direction.

## Persistence (Dexie)

- A schema change is a new `this.version(n)` block with an upgrade path; the
  shipped block is never edited, because phones that already ran it upgrade
  from it.
- The service worker and the app share one database. Flag a change to the
  schema or to how records are written that only considers one of them.

## Generated code

- Do not report on `pnpm-lock.yaml`, `dist/`, `dev-dist/` or
  `worker/worker-configuration.d.ts`; flag the source change that produced them.
- Flag a hand edit to a generated file.

## Language conventions

TypeScript. The `references/code-quality.md` rules (magic values, nesting,
naming) apply as written. Style and these rules are enforced by Biome, so do
not report them: formatting, import order, type assertions (`as T`, via the
`no-type-assertion` plugin) and stray `console` calls. Function names SHOULD
start with a verb (`findLatestPendingTimer`, not `latestPendingTimer`).
