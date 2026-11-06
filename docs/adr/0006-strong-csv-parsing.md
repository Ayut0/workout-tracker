# 0006. Reading the Strong CSV export

- Status: accepted
- Date: 2026-11-06

## Context

The Strong import (#33 parses, #34 stores) is the only way years of history
reach the app, and a wrong reading is data loss that nobody notices until a
chart looks off. Strong's export has changed across versions: column names
("Duration" as "1h 5m" or "Duration (sec)" as seconds; "Weight", "Weight (kg)",
"Weight (lbs)" or a per-row "Weight Unit"), set orders that are numbers or
letters ("W", "D", "F"), separate "Rest Timer" rows, and in some locales
semicolons with decimal commas. The Date column has no time zone.

## Decision

- The parser (`src/lib/strongCsv.ts`) is pure: text in, plain workouts →
  exercises → sets out. It does not touch IndexedDB and passes exercise names
  through unchanged; the importer matches them with `normalizeExerciseName`.
- **Weight is converted to kg once, unrounded** (ADR-0002), and distance to
  metres. The unit comes from the row's unit column, else the header, else a
  caller-supplied option. If a row needs a unit that none of these give, the
  parser returns `needsUnits` instead of guessing, so the UI asks the lifter.
- **Dates are read as local time on the device** doing the import. The export
  is written in the lifter's own zone; importing on a phone set to another
  zone shifts every workout by the difference.
- **A row is never dropped silently.** Rows with the wrong number of columns,
  an unreadable date, no exercise name, or a measurement that is not a number
  are listed in `skipped` with their line and reason. Rest-timer rows are
  skipped the same way, since they are not sets.
- Warm-up, drop and failure sets are kept as ordinary sets in file order; the
  schema has no set type yet.
- Strong writes 0 for a field the exercise does not use, so 0 is read as
  "not recorded" for weight, reps, distance, seconds and RPE.
- A workout is identified by its date, name and (newer exports) workout
  number. An unreadable duration ends the workout at its start, so imported
  workouts never look in progress.

## Consequences

- Set types (warm-up, drop) are lost on import; adding them later means a new
  field and re-importing.
- A genuine 0 kg set (an empty bar is never 0, but a bodyweight entry may be)
  is stored without a weight, which Volume already treats as 0.
- Formats the parser has not seen surface as `invalid` or as skipped rows the
  lifter can read, not as wrong numbers. The maintainer's real export, kept
  in git-ignored `fixtures/private/`, is the check before the first import.
