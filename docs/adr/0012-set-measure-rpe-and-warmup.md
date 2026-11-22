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
- **RPE** — #64: enter RPE on a set with a 6–10 chip row.
- **Warm-up sets** — #65: mark warm-ups and leave them out of progress.

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
  complete sets, as GLOSSARY.md defines them. A reps, seconds or distance set
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

## RPE (#64)

### Decision

- **A chip row 6 · 7 · 8 · 9 · 10 under every set**, whatever the
  exercise's measure, in the active workout and when editing a past workout.
  It sits on a second line of the set row spanning all columns, so the
  weight and reps inputs keep their width at phone size. One tap sets the
  RPE; tapping the selected chip again clears it (the field is deleted, as
  `updateSet` does for any `undefined` change). RPE is optional and nothing
  asks for it.
- **Whole numbers only from the chips.** Half points (8.5) are a precision
  the MVP does not need on a phone; RPE below 6 says little about effort
  near failure, so the row starts at 6.
- **A stored RPE no chip stands for is kept and shown.** The Strong import
  can store 8.5 (and backups or imports could hold a value outside 6–10).
  Such a value selects no chip and is shown as a dashed, non-tappable chip
  ("8.5") before the row; it is only overwritten when the lifter taps a
  chip (tapping 8 or 9 replaces 8.5 with that value). Half-highlighting both
  8 and 9 was rejected: it reads as two selections and does not say which
  value is stored.
- **The stored value is shown as stored.** The dashed chip prints the value
  unrounded (8.04 shows "8.04", not "8"), so it never looks like the
  unselected chip 8 beside it; a value that is not exactly a chip selects no
  chip, and tapping a chip sets it.
- **Set-or-clear is decided inside the write.** A chip tap calls
  `updateSet(id, { toggleRpe: n })`, which compares against the RPE stored in
  the transaction. Deciding from the rendered props would let two quick taps
  (before the live query re-renders) both compute "set".
- What the row shows is a pure function in `src/lib/rpe.ts`
  (`describeRpeChips`, `buildRpeOtherLabel`); `RpeChips` only renders it.
- Chips are 44px tall like the other controls of the set row and wrap
  rather than shrink at 320px. The group is named per set (`<set> RPE`) and
  the dashed chip reads "RPE 8.5".
- **No schema or backup change.** `WorkoutSet.rpe` already exists
  (ADR-0002) and `parseBackup` already checks it is a number when present.
  RPE is not copied into new sets (`planNextSet`) or templates, and the
  progression rule records but does not use it (ADR-0013).

### Consequences

- Every set row is taller by one chip line; a long workout scrolls more.
- Templates do not plan an RPE; planned effort belongs to #69 (RIR).

## Warm-up (#65)

### Decision

- **`WorkoutSet.warmup?: boolean`, marked by hand.** Optional and not
  indexed, so no Dexie version (ADR-0002). Only `true` is stored; clearing
  the mark deletes the field (`updateSet` with `warmup: undefined` or
  `false`), so a working set looks as it did before #65. Planned sets
  normalise the same way (`copyTemplateSet`, `copyPlannedSet`), and a
  restore drops a `warmup: false` from a hand-edited or foreign backup. Nothing infers a warm-up from a
  lighter weight: the lifter decides.
- **A "W" toggle on every set** — active workout, a past workout's edit view
  and a template's planned sets — on the set row's second line, before the
  RPE chips (#64). A warm-up row's number is muted. The toggle is
  `toggleWarmup` in `src/lib/warmup.ts`.
- **Templates plan warm-ups.** `TemplateSet.warmup?` uses the same flag.
  Starting a workout from a template and saving a workout as a template copy
  it with the measure's fields (`copyPlannedSet` in `src/db/workoutLog.ts`),
  so warm-ups arrive pre-marked and survive the round trip. Templates are
  stored whole, so again no schema version.
- **Adding a set does not copy the mark.** `planNextSet` (Add set, and Add
  set in the template editor) copies the measure's fields only: the set
  after a warm-up is usually the first working set, and a mistaken warm-up
  would silently drop out of Volume. Marking another warm-up is one tap.
- **Warm-ups are left out of every progress number:** Volume (the History
  row and the Progress chart), Estimated 1RM, heaviest weight and all
  personal records (`src/lib/metrics.ts`: a warm-up is not a working set, so
  it has no load). A workout whose only complete sets are warm-ups gives no
  progress point. The progression rule already skipped them (ADR-0013,
  `src/lib/progression.ts`).
- **The Previous column keeps warm-ups.** It lines up today's set N with set
  N done last time; a workout started from the same template has its
  warm-ups in the same places, so leaving them out would misalign the
  working sets instead. Filling from Previous copies measurements only, never
  the mark (#28's rule), so a past warm-up's hint is prefixed "W" (e.g.
  "W 40 kg × 10", `formatPreviousSet`): tapping it fills a working set with
  warm-up numbers, and the prefix says so. A workout whose only complete sets
  are warm-ups still counts as "last time"; skipping it would show an older
  workout's numbers for a lift done more recently.
- **Backup** (ADR-0011): `parseBackup` checks `warmup` is true or false
  when present on sets and template sets, and drops a `false` so only `true`
  is stored. Backups made before #65 have none
  and restore as working sets.

### Consequences

- The Strong export marks warm-ups with "W" in its Set Order column
  (ADR-0006), but the import does not read it yet: imported warm-ups count
  as working sets until marked by hand. Reading it is a follow-up, kept out
  of #65 because it changes the import's writes (an Escalation path).
  Follow-up: in `src/db/strongImport.ts` (parser in `src/lib/strongCsv.ts`),
  read a "W" in the Set Order column as `warmup: true` on that set, and
  number the working sets after it from 1 as Strong does; test with a
  Strong export that has warm-ups, and record it in an ADR as an Escalation
  change (import writes).
- Each planned set in the template editor gains a second line for the "W"
  toggle.
