# 0005. Exercise library: names, removal and restore

- Status: accepted
- Date: 2026-11-06

## Context

The Exercises tab (#26) lets the user create, rename and remove exercises.
Removing is a destructive write, and the Strong import (#33, #34) matches
exercises by name, so how names and removal behave must be predictable.
ADR-0002 already decided that names are unique after normalising (`nameKey`)
and that `removeExercise` archives an exercise history refers to and deletes
it otherwise.

## Decision

- **Create and rename go through `createExercise` / `renameExercise`** in
  `src/db`. Both return a typed `ExerciseNameResult` instead of throwing:
  `empty` for a blank name, `duplicate` (with the exercise that holds the
  name) or `not-found`. The stored `name` is trimmed with runs of spaces
  collapsed; its case is kept. The check and the write share one transaction,
  and the unique `&nameKey` index still backs it.
- **Archived exercises keep their name reserved.** A new exercise cannot take
  an archived one's name; the user is told to restore it instead. This keeps
  one exercise per name, so the import never has two candidates and history
  is not split across two exercises with the same name.
- **Archive is reversible.** `restoreExercise` clears `archivedAt`; the
  Exercises tab lists archived exercises with a Restore button.
- **Delete stays limited** to exercises nothing refers to (ADR-0002), behind a
  confirm. Such an exercise holds only its name, so deleting it loses no
  workout data.
- **Rename keeps history.** Workouts and templates refer to exercises by id,
  so past workouts show the new name.

No schema change: this uses the version-2 `exercises` store as it is.

## Consequences

- Renaming an exercise to a Strong name changes which exercise a later import
  matches; that is intended (it is how the user merges naming).
- There is no merge of two existing exercises; that would rewrite history and
  needs its own decision.
