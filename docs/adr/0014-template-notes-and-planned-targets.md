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
  The editor keeps what is typed (line breaks included) until Save.
- **Edited only in the template editor.** Each exercise card in the editor
  has a notes field (add, edit, clear). While logging, and in History, the
  notes are shown read-only under the exercise name (`ExerciseNotes`); a
  lifter who wants a different cue edits the template. Editing a workout's
  copy is a possible follow-up, not needed for the MVP.
- **Backup** (ADR-0011): `parseBackup` checks both fields are text when
  present. Older backups have neither and restore unchanged; the schema
  version does not change.

### Consequences

- Notes typed into a template after a workout started do not reach that
  workout; the lifter sees them next time.
- History shows the cue the workout was done with, which explains an odd set
  (a different seat) months later.
