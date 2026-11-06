# 0010. Templates: whole-record edits, copy on start, plain delete

- Status: accepted
- Date: 2026-11-06

## Context

Templates (#31) let the user save a routine and start a workout from it.
ADR-0002 already stores a template as one record in the `templates` store,
with its exercises and planned sets (`{ weightKg?, reps? }`) inside it, and
ADR-0007 gave `startWorkout` optional planned exercises for this. What was
left to decide: how editing is saved, what starting from a template copies,
what saving a workout as a template keeps, and what deleting a template
does, since a delete is a destructive write (AGENTS.md § Escalation). The
schema does not change.

## Decision

- **Writes live in `src/db/templates.ts`**, tested against fake-indexeddb:
  `createTemplate`, `updateTemplate` (replaces name and exercises),
  `deleteTemplate`, `listTemplates` (by name, ignoring case), `findTemplate`,
  `startWorkoutFromTemplate` and `templateFromWorkout`. A blank name is
  rejected with `{ ok: false, reason: "empty" }`; names are trimmed with
  runs of spaces collapsed. Names need not be unique.
- **The editor holds a draft and saves on Save.** Unlike the active workout
  (ADR-0007), a template is planned calmly, not at the gym, and is written as
  a whole record; a draft lets Cancel leave the template as it was. The draft
  edits are pure functions in `src/lib/templates.ts`.
- **Starting copies.** `startWorkoutFromTemplate` passes the template's
  exercises to `startWorkout`, which writes new workout exercise and set
  records with copies of the planned weight and reps, none marked done; the
  workout is named after the template. Nothing links the workout back to the
  template, so editing the workout never changes the template and editing
  the template never changes a past workout. It refuses while a workout is
  active, as `startWorkout` does.
- **Saving a workout as a template keeps only complete sets.** An incomplete
  set in a finished workout is one that was skipped, and only complete sets
  count anywhere else (Volume, Estimated 1RM). An exercise with no complete
  set is left out, and a workout with none gives no template
  (`no-complete-sets`). The template is named after the workout.
- **Delete is a plain delete behind a confirm.** A template is only a plan:
  workouts started from it hold their own copies, so deleting it loses no
  history, and its exercises stay in the library (an exercise archived only
  because this template used it stays archived until restored). There is no
  undo.

## Consequences

- A template that refers to an exercise later archived still works; the
  editor names it from all exercises, archived included.
- If a user never marks sets done, "Save as template" saves nothing; the
  notice says why. They can still build the template by hand.
- Templates have no usage history ("last performed"); adding a link from
  workout to template later would need its own decision.
