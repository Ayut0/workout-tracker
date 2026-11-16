# 0014. Template exercise notes and planned set targets

- Status: accepted
- Date: 2026-11-15

## Context

A template (ADR-0010) plans exercises and sets, but not the cues a lifter
wants to see at the gym ("seat 4", "pause at the bottom"), nor what a set is
aiming for. ADR-0010 copies a template into a workout and keeps no link back,
so anything shown while logging has to be copied too. This ADR collects the
decisions; each section belongs to one issue:

- **Exercise notes** — #66: notes on a template exercise, shown while logging.
- **Planned targets** — #69: a rep range and target RIR on planned sets,
  copied into the workout's sets.

## Exercise notes (#66)

### Decision

- **Where they live.** `TemplateExercise.notes?: string` on the template, and
  `WorkoutExercise.notes?: string` on the workout side. Both are optional and
  not indexed, so there is no Dexie version (ADR-0002); a template is stored
  whole, and a workout exercise is a plain record. The Exercise library gets
  no notes: a cue belongs to a plan (seat 4 on one gym's machine), not to the
  movement everywhere.
- **Copied, not linked** (ADR-0010). `startWorkout` copies a planned
  exercise's notes into the new workout exercise, so editing the template
  later never changes a past workout, and a workout started without a
  template has none. Saving a workout as a template carries them back.
- **Stored tidy.** Notes are trimmed when written (`tidyNotes` in
  `src/db/workoutLog.ts`); blank notes are not stored at all, so clearing the
  field removes it and records without notes look as they did before #66.
  The editor keeps what is typed (line breaks and whitespace-only text
  included) until Save, where `tidyNotes` drops blanks. Restoring a backup
  tidies notes the same way, so a blank note in a file never reaches the
  store, and `ExerciseNotes` also renders nothing for blank text.
- **Edited only in the template editor.** Each exercise card in the editor
  has a notes field (add, edit, clear). While logging, and in History, the
  notes are shown read-only under the exercise name (`ExerciseNotes`); a
  lifter who wants a different cue edits the template. Editing a workout's
  copy is a possible follow-up, not needed for the MVP.
- **Backup** (ADR-0011): `parseBackup` checks both fields are text when
  present, then tidies them. Older backups have neither and restore unchanged; the schema
  version does not change.

### Consequences

- Notes typed into a template after a workout started do not reach that
  workout; the lifter sees them next time.
- History shows the cue the workout was done with, which explains an odd set
  (a different seat) months later.

## Planned rep range and target RIR (#69)

### Decision

- **Fields.** `repMin?`, `repMax?` and `targetRir?` on both `TemplateSet` and
  `WorkoutSet` (the shared `PlannedTargets` type). Optional and not indexed:
  no Dexie version (ADR-0002). Whole numbers: `repMin` and `repMax` 1 to 999,
  `targetRir` 0 to 99 (`MAX_REPS`, `MAX_RIR`); a range has both ends or
  neither, and `repMin` is not above `repMax`. The caps keep a typo from
  becoming a value JSON cannot hold (a huge number is written as null).
- **Stored on the workout's sets, copied like weight and reps** (ADR-0010).
  Starting from a template copies a planned set's targets into the new set,
  so the Progression rule (ADR-0013, `src/lib/progression.ts`) reads the range
  from the last workout's sets without a link to the template. Targets are
  copied only from a template: `copyPlannedSet` (start a workout, and a
  completed set back into a template saved from a workout) and
  `planNextTemplateSet` (a planned set added in the editor, which is
  planning, so it aims for what the set before it aimed for). `planNextSet`,
  used by `addSet` while logging, copies measurements only: a set added
  mid-workout was not planned, and a back-off set (say 60 kg for 3 reps after
  2 x 100 kg for 4-6) must not join the working sets' group and be judged
  against their range by Progression. Filling a set from the Previous column
  copies measurements only, never targets.
- **Only for measures that count reps** (`plansTargets`: weight-reps and
  reps). A rep range means nothing to a plank or a carry, so seconds and
  distance sets neither show nor copy targets; values already stored are
  kept, only hidden, as for measures (ADR-0012).
- **Entry.** Each planned set in the template editor has a "Rep range" field
  and an "RIR" field under its measurements. A single number plans exactly
  that many reps (`8` is stored as 8–8, shown as "8"); `6-8`, `6–8` or
  `6 to 8` plans a range (also `6~8`, a minus sign, and full-width digits
  from a Japanese keyboard); blank clears it. A range with its ends swapped,
  a fraction, a negative number, 0 reps or a value over the cap is not
  saved: the field keeps its last good stored value and stays marked invalid,
  also after it loses focus, until the text reads or is cleared. Parsing and
  formatting live in `src/lib/plannedTargets.ts`.
- **Shown read-only while logging**, as a line under the set's inputs:
  "Target 4–6 reps · RIR 2" (`SetTargets`). History shows the same. The
  targets are edited in the template, not in the workout, for the MVP.
- **Backup** (ADR-0011): `parseBackup` checks the three fields on template
  sets and workout sets (whole numbers within the caps above, so a backup the app writes always
  passes) and checks the range across fields (both ends, bottom not above top) with a per-record rule.
  Older backups have none and restore unchanged; the schema version does not
  change.

### Consequences

- RPE, logged per set (ADR-0012), and target RIR are not compared yet; a
  "hit the target RIR" hint is a possible follow-up.
- An exercise-level default range (`ProgressionInput.repMin`/`repMax`) is
  not stored anywhere yet; until it is, Progression only judges sets planned
  with a range.
- A workout not started from a template has no targets, so Progression has
  nothing to judge for it, and neither do sets added during a workout.
