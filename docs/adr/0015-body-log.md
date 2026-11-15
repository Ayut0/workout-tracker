# 0015. Body log: one entry per local day, in a new store at Dexie version 3

- Status: accepted
- Date: 2026-11-15

## Context

#73 asks for a body log: body weight and waist by date, with a simple entry
form and a chart over time. It needs a new store, so it is the first change
that bumps the Dexie schema since ADR-0002 (version 2), and it touches the
backup format (ADR-0011), which must keep restoring older files. Both are
Escalation triggers in AGENTS.md (IndexedDB schema versions, destructive
writes through restore).

## Decision

- **Record.** `BodyEntry { id, date, bodyWeightKg?, waistCm? }` in a new store
  `bodyEntries`, indexes `id, &date`. Ids are random strings, as everywhere
  (ADR-0002).
- **`date` is a local calendar day, `"YYYY-MM-DD"`, not epoch ms.** A body
  measurement belongs to a day, not an instant: a day string stays the same
  day when the phone changes time zone (an epoch time taken late in the
  evening could show as the next day after travel), sorts correctly as text,
  is exactly what `<input type="date">` reads and writes, and lets the index
  enforce one entry per day. Charts turn it into local midnight.
- **One entry per day** (unique `&date` index). Weigh-ins are compared day to
  day; several per day would need a rule for which one to chart. Saving a day
  that has an entry keeps its id and replaces its measurements exactly: a
  field left blank removes that measurement. An entry holds at least one
  measurement (checked by the form, `parseBodyEntryForm`).
- **Units.** Body weight is stored in kg, unrounded, and shown and typed in
  the weight unit setting, like every weight (CONTEXT.md § Units). Waist is
  stored, typed and shown in **cm** whatever the weight unit; inches for
  pound users are a possible follow-up (display-only, no migration).
  Re-saving a day whose field still shows the stored value (rounded to one
  decimal, in the user's unit) keeps the stored value exactly, so editing one
  measurement never rounds the other.
- **Schema.** `WorkoutDB` gets `this.version(3).stores({ bodyEntries: "id,
  &date" })`. Version 1 and 2 blocks are untouched. It only adds a store, so it
  needs no upgrade function: Dexie keeps every version-2 store, index and
  record. A test opens a database written with the shipped version-2 schema,
  holding records in every store, and checks that version 3 keeps them all,
  that the old indexes still answer, and that the new store is empty and
  usable. The service worker opens the same database through the same
  `WorkoutDB` class; a new deployment ships both at version 3, and Dexie
  closes an older open connection on `versionchange` so the upgrade is not
  blocked.
- **Backup.** `bodyEntries` is a backed-up store (`BACKUP_STORES`), so export
  carries it and restore clears and replaces it in the same single
  transaction as the rest (restore replaces everything, ADR-0011).
  `BACKUP_SCHEMA_VERSION` is 3. A migration step `2 → 3` adds an empty
  `bodyEntries` list, so version-2 (and, through both steps, version-1)
  backups still restore; restoring one empties the body log, as a restore
  replaces everything. `parseBackup` checks each entry (`date` a real
  `YYYY-MM-DD` day, measurements finite numbers) and rejects two entries for
  the same day, which the unique index would refuse mid-write.
- **Where it lives.** Not a new tab: the tab bar already has five. The body
  log is a screen at `/progress/body` under the Progress tab, linked from the
  top of Progress. It has the form (day, defaulting to today, body weight,
  waist; picking a day with an entry fills it in), the two charts with the
  3M / 1Y / All ranges, reusing `LineChart` and `src/lib/chart.ts`, and the
  list of days, newest first, each deletable after a confirm.
- **Chart datum.** `ChartDatum.workoutId` is renamed `id`, since a point is
  now a workout or a body log entry; `LineChart` takes an optional noun for
  its screen-reader summary ("12 entries from …").

## Consequences

- Older app versions cannot read a version-3 backup (they reject it as made
  by a newer version, as ADR-0011 intends).
- A phone that never opens the new version keeps version 2; nothing is lost
  either way, since the upgrade only adds a store.
- Body weight and waist are personal data that stay on the phone and in the
  backup file, like the training log; the notification worker never sees
  them.
- Downsampled body charts keep the highest value of each run of days (the
  shared `downsampleSeries` rule, which favours peaks). That suits records
  more than body weight; it only applies above 120 points in a range.
