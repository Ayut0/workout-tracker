# 0001. Store records in IndexedDB with Dexie, one numbered version per schema change

- Status: accepted
- Date: 2026-11-03

## Context

The app is local-first: records live on the phone and no workout data goes to a
server (README). Phase 1 only needs a log of rest timers, so the phone can
measure how late each push arrived. The service worker writes the arrival time
and the app reads it, so both contexts open the same database.

Phase 2 adds exercises, templates and sets with the Strong import. Phones will
already hold phase-1 data by then, so the schema must be able to change without
losing it.

## Decision

- Use IndexedDB through Dexie (`src/db`).
- One object store per kind of record. Phase 1 has `restTimers`, keyed by a
  random `id` and indexed on `scheduledAt` and `status`. Other fields are stored
  as they are and are not indexed.
- A schema change is a new `this.version(n)` block, with an `upgrade` step when
  records need rewriting. A shipped block is never edited, because phones that
  already ran it upgrade from it.
- The app and the service worker use the same `WorkoutDB` class, so they cannot
  disagree about the schema.

## Consequences

- Records stay on the device and work offline. The cost is that clearing site
  data deletes them; the app asks the browser for persistent storage to reduce
  that risk, and there is no server copy.
- Each phase-2 change needs a version block and a test that upgrades from the
  previous version.
- Anything that drops or rewrites records (including the Strong import) needs
  its own review under `AGENTS.md` § Escalation.
