# 0008. Storing the Strong import

- Status: accepted
- Date: 2026-11-06

## Context

The Strong import (#34) writes years of history into IndexedDB in one go,
usually into a database that already holds workouts logged in the app. It is
the largest write the app makes, and the lifter may run it more than once
(an export taken later contains everything the earlier one did). A wrong
write here is data loss: an existing workout changed or removed, history
duplicated so Volume and Estimated 1RM double count, or half an import left
behind after a failure. ADR-0006 covers reading the CSV; this covers storing
it.

## Decision

- **Add only.** The import never updates or deletes a stored record. Existing
  workouts, exercises (including their rest and archived state), workout
  exercises and sets are left exactly as they are.
- **Preview, then confirm.** Parsing and planning write nothing. The plan
  (`planStrongImport`, pure) lists the workouts to add, the workouts skipped
  as already stored, their date range, the exercises to create and the rows
  the parser skipped. Only Confirm writes.
- **Idempotency key: start time + workout name**, the name compared ignoring
  case and spacing (`toWorkoutImportKey`). A workout whose key is already
  stored is skipped, so importing the same file, or a later export that
  contains it, adds nothing for it. Duplicates are checked against the
  database only, not within the file: two workouts in one file with the same
  key are both added (and both skipped on the next import).
- **Exercises match by `nameKey`** (`normalizeExerciseName`), archived ones
  included (ADR-0005): a match is reused, never renamed or restored, and an
  exercise is created only for a name nothing matches, spelled as first
  written in the file.
- **One transaction.** `importStrongWorkouts` reads, re-plans and writes in a
  single read-write transaction over exercises, workouts, workoutExercises
  and sets, so either every new record is added or, if anything fails, none
  is. It re-checks duplicates inside the transaction, so a preview that went
  stale cannot add a workout twice. Records are written with `bulkAdd`, so
  thousands of workouts import in one pass; only stored workouts that start
  when an imported one does are read for the duplicate check.
- **Sets are complete.** Strong exports only done sets and no time per set,
  so each imported set gets `completedAt` = its workout's end time.
- **Persistent storage first.** Before writing, the app asks the browser to
  keep its data (`navigator.storage.persist()`, via
  `requestPersistentStorage`). The answer does not block the import.
- No schema change: the version-2 stores and the `startedAt` index suffice.

## Consequences

- A workout edited in Strong after an earlier import (same start and name) is
  not updated by a re-import; it is skipped. Updating imported workouts would
  rewrite stored records and needs its own decision.
- A workout logged in the app with exactly the same start time (to the
  millisecond) and name as one in the export would be treated as the same
  workout. App start times carry milliseconds and Strong's carry whole
  seconds, so this is unlikely.
- Renaming a workout here and then re-importing adds it again under the
  Strong name, because the key includes the name.
- Dates are local time (ADR-0006): importing the same file on a phone in a
  different time zone shifts start times, so the keys do not match and the
  workouts are added again.
- The transaction holds every new record in memory at once; a very large
  history (tens of thousands of workouts) may need batching later.
