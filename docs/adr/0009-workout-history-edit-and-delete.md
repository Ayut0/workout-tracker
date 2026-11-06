# 0009. History: paging, editing past workouts, and delete

- Status: accepted
- Date: 2026-11-06

## Context

History (#30) lists finished workouts and lets the lifter fix or remove one.
After the Strong import (ADR-0008) it may hold several years of workouts, a
few thousand, each with its sets. Editing reuses the writes the Workout tab
logs with (ADR-0007). Two of the edits are risky: moving a workout's start
can break how the active workout is found (ADR-0002: the latest started
workout with no `endedAt`), and delete is a destructive write, which
AGENTS.md lists as an Escalation trigger. No schema change is needed.

## Decision

- **Paged along the `startedAt` index.** `listWorkoutHistory` reads one page
  (30) of finished workouts newest first, walking the index in reverse, and
  loads only that page's workout exercises, sets and library exercises. The
  page ends at a cursor `{ startedAt, id }`; the next page starts after it.
  Workouts with the same start are ordered by id, as IndexedDB walks ties, so
  none is skipped or shown twice. "Load more" adds a page; each page is its
  own live query that starts after the previous page's live last row.
  Active workouts are not history and are filtered out.
- **Edits reuse ADR-0007's writes** (`updateWorkout`, `addWorkoutExercise`,
  `removeWorkoutExercise`, `moveWorkoutExercise`, `addSet`, `removeSet`,
  `updateSet`, `completeSet`, `uncompleteSet`), each its own transaction and
  saved as typed. A set marked done in a past workout gets the workout's end
  time as `completedAt`, as imported sets do.
- **Moving the start moves the whole workout** (`rescheduleWorkout`, one
  transaction): `endedAt` and every set's `completedAt` shift by the same
  amount, so the duration stays and set times stay inside the workout. The
  start is edited to the minute (`datetime-local`).
- **A new start is refused** when it is in the future, or at or after the
  active workout's start: either would make a finished workout the latest
  started one and hide the active workout from `findActiveWorkout`.
- **Delete reuses `deleteWorkout`**: the workout, its workout exercises and
  their sets go in one transaction, so nothing is left half-deleted. The
  screen asks for confirmation first (naming the workout), then returns to
  the list, replacing the deleted workout's history entry so Back does not
  land on it. Library exercises are untouched. There is no undo and no
  trash, as with discard in ADR-0007.

## Consequences

- A deleted workout is gone; Progress charts and records lose its sets at
  once. If that proves too easy to hit, soft delete needs its own decision
  (the import and metrics would have to skip soft-deleted workouts).
- Deleting an imported workout and importing the same Strong export again
  adds it back (ADR-0008 skips only workouts still stored). Renaming one or
  moving its start does the same, because the import key is start + name.
- Editing the start drops its seconds when the minute changes; a start left
  as it was is not rewritten.
- The list forgets how many pages were loaded when the lifter leaves it, so
  returning from a workout's detail starts at the newest page again.
