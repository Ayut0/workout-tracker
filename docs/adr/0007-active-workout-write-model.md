# 0007. Active workout: saved as you go, one at a time, discard deletes

- Status: accepted
- Date: 2026-11-06

## Context

The Workout tab (#27) logs a workout at the gym. A phone can kill the PWA at
any moment (app switch, low memory, crash), so nothing typed may live only in
React state. Later work builds on the same writes: the Previous column (#28),
the rest timer on set completion (#29), editing and deleting finished
workouts from History (#30) and starting from a template (#31). Discard is a
destructive write, which AGENTS.md lists as an Escalation trigger. The
schema is the version-2 one from ADR-0002; nothing here changes it.

## Decision

- **Every edit is its own IndexedDB transaction**, written the moment it
  happens: start, rename, notes, add / remove / move exercise, add / remove /
  edit set, complete / uncomplete set, finish, discard. The functions live in
  `src/db/workoutLog.ts` with no React, and are tested against
  fake-indexeddb. Weight and reps are written on every keystroke that parses;
  text that does not parse yet (e.g. "62,") is not written.
- **The screen holds no copy of the workout.** It reads the active workout
  through `useLiveQuery(findActiveWorkoutDetail)` and re-renders after each
  write. Inputs show the user's draft only while focused (`useDraftField`),
  so a normalised stored value never fights the typing. Reopening the app
  resumes the active workout from storage, as ADR-0002 defines it: the
  latest started workout with no `endedAt`.
- **One active workout at a time.** `startWorkout` checks for an active
  workout in the same transaction and, if there is one, returns
  `{ ok: false, reason: "active", active }` instead of starting a second; the
  caller resumes it. A second active workout would be invisible to
  `findActiveWorkout`, which only looks at the latest one.
- **`startWorkout` takes optional planned exercises** (`{ exerciseId, sets:
  { weightKg?, reps? }[] }[]`, a template's shape) so #31 starts from a
  template in the same transaction.
- **Order stays dense.** Removing or moving an exercise or set renumbers its
  siblings 0, 1, 2… in the same transaction (ADR-0002's integer `order`).
- **Finish sets `endedAt`** and keeps every set as entered, done or not;
  only complete sets count towards Volume and Estimated 1RM anyway. A workout
  that has already ended is not finished again.
- **Discard deletes** the workout, its workout exercises and their sets in
  one transaction (`deleteWorkout`), so nothing is left half-deleted. The UI
  asks for confirmation first; removing an exercise from the workout also
  asks, since it deletes that exercise's sets. There is no undo and no trash:
  an active workout that is discarded was never history. Library exercises
  are untouched.
- **The set and exercise writes do not require the workout to be active**,
  so editing a finished workout from History (#30) reuses them, and History's
  delete reuses `deleteWorkout` behind its own confirmation.
- **`completeSet` returns the set with its workout exercise and library
  exercise**, and the screen passes that to an `onSetCompleted` callback: the
  rest timer (#29) picks the exercise's rest or the default from it.

## Consequences

- Many small writes while typing; IndexedDB handles that easily for one
  person's workout, and it is what makes a kill lose nothing.
- Discard cannot be undone. If that proves too easy to hit, a later change
  can soft-delete instead; that needs its own decision because the import and
  metrics would have to skip soft-deleted workouts.
- A workout imported with a later start time than the active one (#34) would
  hide the active one from `findActiveWorkout`. Imported workouts are past
  workouts, so this only happens with a wrong device clock.
