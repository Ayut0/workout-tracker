# 0002. Training records in Dexie version 2

- Status: accepted
- Date: 2026-11-03

## Context

ADR-0001 put records in IndexedDB through Dexie and expected phase 2 to add
exercises, templates, workouts and sets. Phones already hold version-1
`restTimers`, so the new stores must arrive without touching them.

Later work builds on this schema: the exercise library (#26), logging a
workout (#27), settings (#32), the Strong import (#33, #34), progress metrics
(#35) and backup (#37). The Strong export has, per row: workout name, date,
duration, workout notes, exercise name, set order, weight, reps, distance,
seconds, notes and RPE.

## Decision

`WorkoutDB` gets a `version(2)` block that only adds stores. `version(1)` is
unchanged and no upgrade step is needed.

| Store | Indexes | Holds |
| --- | --- | --- |
| `exercises` | `id, &nameKey` | `name`, `nameKey`, optional `archivedAt` |
| `workouts` | `id, startedAt` | `name`, `startedAt`, optional `endedAt`, `notes` |
| `workoutExercises` | `id, workoutId, exerciseId` | `order` within the workout |
| `sets` | `id, workoutExerciseId` | `order`, optional `weightKg`, `reps`, `distanceM`, `seconds`, `rpe`, `notes`, `completedAt` |
| `templates` | `id` | `name`, `exercises: { exerciseId, sets: { weightKg?, reps? }[] }[]` |
| `settings` | `id` | one record (`id: "app"`): `weightUnit`, `restSeconds` |

- **Ids** are random strings from `crypto.randomUUID()`, as for `restTimers`.
  They need no counter, so records made on the phone, by the import and by a
  restore cannot collide.
- **Weight is stored in kilograms**, unrounded. kg/lb conversion and rounding
  happen only at display and input (#32), so changing the unit never rewrites
  records and repeated conversions do not drift. The import converts a
  pound export once. Distance is stored in metres.
- **Order** is an integer `order` field (from 0) on `workoutExercises` and
  `sets`, sorted on read. Reordering rewrites the `order` of the siblings,
  which are only a handful. Templates are read and written whole, so their
  exercises and sets are arrays inside the record and order is array position.
- **`workoutExercises` sits between workouts and sets.** It gives an exercise
  its place in the workout before any set exists (#27), lets the same exercise
  appear twice, and is indexed by `exerciseId` so one exercise's history (#35)
  is two indexed queries. Sets do not repeat the workout or exercise id, so
  nothing can disagree.
- **Duration** is `endedAt - startedAt`. A workout without `endedAt` is in
  progress; the active workout is the latest started one if it has not ended.
- **Exercise names are unique after normalising** (trim, collapse spaces,
  lower case) through the unique `nameKey` index, because the import matches
  exercises by name (#26, #34).
- **Exercises referenced by history are archived, not deleted.**
  `removeExercise` sets `archivedAt` when any workout or template refers to the
  exercise and deletes it otherwise, so every stored set still resolves to an
  exercise name.
- **Settings** is one record with defaults filled in on read, so a new setting
  needs no migration.
- Query helpers live in `src/db/index.ts` with no React imports.

## Consequences

- Fields that are not indexed (such as a per-exercise rest override or body
  part) can be added later without a new version; a new index or store needs
  `version(3)`.
- Deleting a workout must also delete its `workoutExercises` and their `sets`
  in one transaction; nothing cascades on its own.
- Finding which templates use an exercise scans `templates`. That is fine for
  a personal template list; add a multi-entry index if it grows.
- The import's idempotency check (#34) can use the `startedAt` index and
  compare the workout name.
