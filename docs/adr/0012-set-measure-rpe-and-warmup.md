# 0012. Set measures, RPE and warm-up sets

- Status: accepted
- Date: 2026-11-15

## Context

Every set row offered weight and reps, so a plank, a run or a farmer's carry
could not be logged as what it is. ADR-0002 already stores `seconds` and
`distanceM` on a set (the Strong import fills them), but nothing let the
lifter type them. This ADR collects the decisions about what a set records.
Each section below belongs to one issue; later issues add sections:

- **Measure** — #63: log a set by weight and reps, reps, seconds or distance.
- RPE — #64 (to be added).
- Warm-up sets — #65 (to be added).

## Measure (#63)

### Decision

- **The measure lives on the exercise.** `Exercise.measure` is
  `"weight-reps" | "reps" | "seconds" | "distance"`, optional and not
  indexed, so there is no Dexie version (ADR-0002: non-indexed fields need
  none). A missing measure means `"weight-reps"`, so exercises stored before
  #63, created by the Strong import or from the exercise picker log weight
  and reps as before, with no migration. `"weight-reps"` is never written:
  choosing it deletes the field, so the default exercise record is unchanged.
  The measure is per exercise, not per set or per workout: a plank is always
  timed, and one place to change it keeps every workout of it alike.
- **Fields shown per measure:** weight-reps → weight and reps; reps → reps;
  seconds → seconds; distance → distance. Distance is stored and typed in
  metres (ADR-0002); time is typed as whole seconds ("45") or m:ss ("1:30")
  and stored as seconds. The set row, its column headings, the Previous
  column and a template's planned sets all follow the exercise's measure.
- **Typed values are capped.** Digit-only input is unbounded ("9" typed 400
  times becomes `Infinity`, which JSON writes as null and `parseBackup`
  rejects), so the readers in `src/lib/workoutLog.ts` reject anything above
  9,999 reps, 86,400 seconds (24 h) or 1,000,000 m, and anything not finite.
  The time field takes whole seconds or m:ss only; "1:30:00" and "1:5" are
  invalid (the input shows the invalid state), and a hold longer than an hour
  is typed as plain seconds. A stored fractional time (the Strong import can
  hold 65.5) is shown rounded to whole seconds, in the input and in the
  Previous column ("1:06"), so what is shown can always be typed back.
- **A carry is distance only for the MVP.** A loaded carry's weight is not
  shown under the distance measure. A `"weight-distance"` (or weighted
  seconds) measure can be added to the union later without a schema change;
  until then a lifter who wants the load can name the exercise after it or
  use weight-reps.
- **Changing the measure keeps logged values.** `setExerciseMeasure` writes
  only the exercise; sets keep every field they hold, only hidden. Switching
  back shows them again. Nothing is lost by a mistaken switch, which keeps
  this off the destructive-write Escalation path.
- **New sets copy only what the measure shows.** `planNextSet(last, measure)`
  — adding a set, a template's planned set, starting from a template and
  saving a workout as a template — copies the measure's fields from the set
  before and nothing else. Values kept hidden after a measure change are
  therefore not carried into new sets, where they would silently count
  towards Volume. The writes read the exercise's measure inside their
  transaction (`resolveMeasure` in `src/db/workoutLog.ts`, so the service
  worker build needs nothing from `src/lib`). Filling a set from the Previous
  column copies the same fields.
- **Template planned sets** gain `seconds?` and `distanceM?`
  (`TemplateSet`); templates are stored whole, so no schema version.
- **Volume and Estimated 1RM are unchanged:** they count weight × reps of
  complete sets, as CONTEXT.md defines them. A reps, seconds or distance set
  has no weight and adds nothing; hidden weight and reps kept after a measure
  change still count, as they did before the switch.
- **Backup** (ADR-0011): `parseBackup` checks `measure` is one of the four
  when present and checks template sets' `seconds` and `distanceM` are
  numbers. Backups made before #63 have neither and still restore unchanged;
  the schema version stays 2.

### Consequences

- `src/lib/progression.ts` reads `weightKg` and `reps` only; when it is wired
  into the app it must skip exercises whose measure is not `"weight-reps"`.

- Progress charts (Estimated 1RM, Volume) show nothing useful for a seconds
  or distance exercise; charting best time or distance is a follow-up.
- The Strong import still creates every exercise as weight-reps. Its seconds
  and distance values are stored but hidden until the lifter changes the
  exercise's measure; inferring a measure on import is a possible follow-up.
- On a phone the seconds field opens the numeric keypad, which has no colon,
  so m:ss is mainly for hardware keyboards; typing plain seconds always works.
