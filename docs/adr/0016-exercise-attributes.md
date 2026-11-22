# 0016. Exercise attributes: muscle groups, movement pattern, category and equipment

- Status: accepted
- Date: 2026-11-15

## Context

#72 asks for optional, descriptive attributes on an exercise: the muscles it
trains, its movement pattern and its category. #75 will count weekly sets per
muscle group from them (a primary muscle counts one set, a secondary muscle
half), so the muscle vocabulary has to be fit for counting. ADR-0013 derived
the progression increment from the name's equipment mark, "(Dumbbell)",
which a lifter cannot set on an exercise named without one.

## Decision

- **Fixed vocabularies**, as `const` arrays in `src/db/constants.ts` (next to
  `SET_MEASURES`, since `parseBackup` checks stored values against them);
  their display labels live in `src/lib/exerciseAttributes.ts`. Values are
  stable kebab-case ids, never shown.
  - **Muscle groups** (16): chest, lats, upper back, lower back, front delts,
    side delts, rear delts, biceps, triceps, forearms, abs, glutes, quads,
    hamstrings, adductors, calves. The groups do not overlap (no "back" next
    to "lats", no "shoulders" next to the delts), so a set adds to each group
    at most once, and they are the groups weekly-volume guidance is usually
    given for. Traps count as upper back, obliques as abs.
  - **Movement pattern** (one, optional): squat, hinge, lunge, horizontal
    push, vertical push, horizontal pull, vertical pull, carry, rotation,
    isolation (a single-joint movement such as a curl).
  - **Category** (one, optional): strength, power, agility, mobility, core.
  - **Equipment** (one, optional): barbell, dumbbell, machine, cable,
    bodyweight, other.
- **Stored on the exercise, optional, not indexed:** `primaryMuscles?`,
  `secondaryMuscles?`, `movementPattern?`, `category?`, `equipment?`
  (`ExerciseAttributes`). Nothing queries by them yet — #75 reads every
  exercise anyway — so there is no Dexie version (ADR-0002). Indexing (a
  multi-entry index on muscles) can come with a new version if a query ever
  needs it.
- **A muscle is primary or secondary, never both.** `setExerciseAttributes`
  keeps each muscle once, in vocabulary order, and drops from the secondary
  list any muscle that is also primary, so #75 never counts a muscle 1.5
  times for one set. The library's chips move a muscle between the two lists.
  Empty lists and unset attributes are stored as no field, so an exercise
  without attributes is the same record as before #72.
- **Edited in the library** (Exercises tab, the expanded exercise): selects
  for equipment, category and movement pattern, each with "Not set", and
  toggle chips for primary and secondary muscles. Each change is saved
  immediately, like the measure, as an edit (set this field, toggle that
  muscle) that `setExerciseAttributes` applies to the stored record inside
  its write transaction. IndexedDB runs the writes one after another, so two
  taps faster than the screen re-renders both land instead of the second
  overwriting the first with attributes read before it. Not offered when adding an exercise, to keep
  that form short; the Strong import and the exercise picker create
  exercises without attributes.
- **Equipment will decide the progression increment when set.**
  `deriveIncrementKg` now takes an exercise (`{ name, equipment? }`) or, as
  before, a name. Dumbbell equipment gives 2 kg per dumbbell; any other
  equipment gives one plate step (2.5 kg), even if the name says
  "(Dumbbell)". With no equipment it falls back to the name's mark
  (ADR-0013). In pounds every step is still 5 lb. This refines ADR-0013's
  increment, not its rule. Nothing calls it with an exercise yet: the
  equipment takes effect once the progression suggestions UI uses
  `deriveIncrementKg`, in a later PR of this stack, not with this change.
- **Backup** (ADR-0011): `parseBackup` checks each muscle list is a list of
  known muscle groups, none twice in a list, none in both lists and neither
  list empty (the app never writes those, and a restore would otherwise break
  "primary or secondary, never both"), and the other three are known values, when present.
  Backups made before #72 have none of them and restore unchanged; the
  backup schema version is not bumped, as the stored shape only gains
  optional fields.

## Consequences

- `parseBackup` checks only the fields it has a spec for and keeps the
  record as read, so the attributes are restored as they were backed up.
- Changing a vocabulary later (renaming or splitting a muscle group) needs a
  migration of stored exercises and of backups; adding a value does not.
- Nothing infers attributes from the name or from Strong exports; filling
  them for an existing library is manual. A built-in catalogue of common
  exercises with attributes is a possible follow-up.
