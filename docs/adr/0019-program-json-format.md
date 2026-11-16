# 0019. Program JSON format and import

- Status: accepted
- Date: 2026-11-15

## Context

The long-term loop (#76): an LLM outside the app reads the backup file
(ADR-0011), designs the next training block (typically four weeks), and writes
a program file; the app imports it as templates. The app has no server and no
LLM, so the file is the whole interface, and it has to be easy to generate,
easy to check, and easy to fix when the generator gets it wrong. ADR-0018
gave templates a `program` link (program, block, week, day, deload) for
exactly this. Importing creates records in bulk, close to the destructive-
write Escalation path (AGENTS.md), so its write rules are recorded here.

## Decision

### The format (version 1)

One JSON object; every field not listed is rejected.

| Path | Type | Meaning |
| --- | --- | --- |
| `format` | `"workout-tracker-program"` | Marks the file. |
| `formatVersion` | `1` | Versions this format. A newer one is refused ("update the app"). |
| `programId` | non-empty text | Stable for every block of one program, e.g. `"upper-lower-2026"`. |
| `name` | non-empty text | The program's name; starts every template's name. |
| `blocks[]` | non-empty list | Blocks (mesocycles). |
| `blocks[].block` | whole number ≥ 1 | The block number, unique in the file. |
| `blocks[].weeks[]` | non-empty list | Weeks of the block. |
| `…weeks[].week` | whole number ≥ 1 | The week within the block, unique in the block. |
| `…weeks[].deload` | `true`/`false`, optional | A deload week (ADR-0013). |
| `…weeks[].days[]` | non-empty list | Training days of the week. |
| `…days[].day` | non-empty text | A short id, unique in the week, e.g. `"A"`. |
| `…days[].name` | non-empty text, optional | What the day trains, e.g. `"Lower"`. |
| `…days[].exercises[]` | non-empty list | Exercises in order. |
| `…exercises[].name` | non-empty text | Matched to the library ignoring case and spacing (ADR-0005), else created. |
| `…exercises[].measure` | `"weight-reps"`, `"reps"`, `"seconds"`, `"distance"`, optional | The exercise's measure (ADR-0012); default `"weight-reps"`. One measure per exercise in the file; it may be given on any mention. |
| `…exercises[].notes` | text, optional | Cues shown while logging (ADR-0014). |
| `…exercises[].sets[]` | non-empty list | Planned sets in order. |
| `…sets[].weightKg` | number ≥ 0 | Kilograms (weight-reps only). |
| `…sets[].reps` | whole number ≥ 0 | Planned reps (weight-reps, reps). |
| `…sets[].seconds` | number ≥ 0 | Time (seconds only). |
| `…sets[].distanceM` | number ≥ 0 | Metres (distance only). |
| `…sets[].repMin`, `repMax` | whole numbers ≥ 0 | Rep range, both or neither, `repMin` ≤ `repMax` (weight-reps, reps). A set gives `reps` or a range, never both. |
| `…sets[].targetRir` | whole number ≥ 0 | Reps in reserve aimed for (weight-reps, reps). |
| `…sets[].warmup` | `true`/`false` | A planned warm-up (ADR-0012). |

Weights are always kilograms, distance metres and time seconds, as stored
(ADR-0002); there is no unit field. A set field the exercise's measure does
not use is an error, so a generator that confuses a plank with a press is
caught instead of silently hiding values. Which measure counts:

- The file's `measure` is only used for an exercise the library does **not**
  have (it is created with it). An exercise already in the library keeps its
  library measure, whatever the file says.
- `parseProgram` (no library) checks set fields against a measure the file
  **states** (on any mention of the exercise). An exercise that states none
  is not checked there, so a timed exercise may omit `measure` when the
  library knows it.
- `planProgramImport` (which sees the library) checks every set against the
  measure the exercise really gets: the library's for a matched exercise,
  the file's for a new one, else the default weight-reps. Fields that
  measure does not use become **preview errors** (with their JSON paths) and
  block the import, which also refuses them inside its transaction
  (`reason: "invalid-sets"`). A matched exercise whose stated measure
  differs from the library's keeps only a preview warning, unless its sets
  also hold fields the library measure cannot hold, which is an error.

### Limits

The file is untrusted and imported in bulk, so `PROGRAM_LIMITS` in
`src/db/programFormat.ts` caps it; each cap has its own error message and a
list over its cap is not looked into further.

| Limit | Value |
| --- | --- |
| File size (checked before the file is read) | 2 MB |
| Blocks in a file / weeks per block / days per week | 12 / 12 / 7 |
| Templates in all (blocks × weeks × days) | 300 |
| Exercises per day / sets per exercise | 30 / 30 |
| Program, day and exercise name length | 100 characters |
| `programId` and day id length | 40 characters |
| Notes length | 500 characters |
| `block`, `week` numbers | at most 99 |
| `weightKg` / `seconds` / `distanceM` | at most 1000 / 86,400 / 100,000 |
| `reps`, `repMin`, `repMax` / `targetRir` | at most 999 / 20 |

Text made only of zero-width characters (zero-width space, joiner,
non-joiner, word joiner, BOM, soft hyphen) counts as empty. The file is
validated once. Day ids are compared, and stored in `program.day`, with runs
of whitespace collapsed (`"A  B"` and `"A B"` are the same day).

Example (one block, one week, two days; `fixtures/program-sample.json` is a
full four-week block with a deload week, made-up loads):

```json
{
  "format": "workout-tracker-program",
  "formatVersion": 1,
  "programId": "example-upper-lower",
  "name": "Example Upper Lower",
  "blocks": [
    {
      "block": 1,
      "weeks": [
        {
          "week": 1,
          "days": [
            {
              "day": "A",
              "name": "Lower",
              "exercises": [
                {
                  "name": "Squat (Barbell)",
                  "measure": "weight-reps",
                  "notes": "Example loads only; plan your own.",
                  "sets": [
                    { "warmup": true, "weightKg": 20, "reps": 10 },
                    { "weightKg": 50, "repMin": 5, "repMax": 8, "targetRir": 3 },
                    { "weightKg": 50, "repMin": 5, "repMax": 8, "targetRir": 3 }
                  ]
                },
                {
                  "name": "Plank",
                  "measure": "seconds",
                  "sets": [{ "seconds": 30 }, { "seconds": 30 }]
                }
              ]
            },
            {
              "day": "B",
              "name": "Upper",
              "exercises": [
                {
                  "name": "Pull Up",
                  "measure": "reps",
                  "sets": [{ "repMin": 5, "repMax": 10, "targetRir": 2 }]
                },
                {
                  "name": "Farmer's Carry",
                  "measure": "distance",
                  "sets": [{ "distanceM": 40 }]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### Validation

- `parseProgram` in `src/db/programFormat.ts`, pure, in the style of
  `parseBackup` but for a generated file: it reports **every** problem (up to
  20, then "…and N more problems."), each prefixed with its JSON path with
  0-based indices, e.g.
  `blocks[0].weeks[1].days[0].exercises[2].sets[0]: repMin (10) must not be more than repMax (8).`
  Unknown fields name the fields allowed there, so a typo (`rep_min`) is
  obvious. Repeated block, week or day numbers name the first one. A JSON
  syntax error passes on the parser's message (with its position).
- Pasting the error list back to the generator is the intended fix loop.

### Import

- **Additive.** One template per block × week × day, named
  `"<Program> · W<week> · <day> — <day name>"`; blocks after the first add
  `B<block> · ` before the week (`"<Program> · B2 · W1 · A — Lower"`), so two
  blocks never share names. Each template carries
  `program: { programId, programName, block, week, day, deload? }`
  (ADR-0018), so workouts started from it record where they sit. Nothing
  stored is changed or deleted: not templates, not exercises, not history.
- **Exercises** are matched by normalized name (`normalizeExerciseName`,
  ADR-0005) against every exercise, archived ones included (an archived
  match stays archived; the template still names it, ADR-0010). Names not
  found are created with the measure the file gives (default weight-reps,
  stored as no field), with the first spelling the file uses. A matched
  exercise keeps its library measure; the preview warns when the file says
  another one. Attributes (ADR-0016) are not part of the format.
- **Re-importing: refuse per block.** A block whose `programId` and `block`
  are already carried by a stored template is refused (`programId` is
  compared ignoring case and spacing, so `"p"` and `"P"` are one program),
  with the block
  named; the lifter deletes that block's templates first, or uses a new
  block number. A new block of the same program (same `programId`,
  `block: 2`) imports alongside the first, so a program grows block by block
  and its workouts group by `programId`. Replacing was rejected: it would
  delete templates the lifter may have edited, which is a destructive write
  this additive import should not do.
- **Preview, then confirm.** Settings → Training program → "Import program":
  pick the file, then either the list of problems or a preview (program
  name and blocks, how many templates, exercises already in the library,
  measure warnings, the new exercises and template names). Only "Add N
  templates" writes; it is not offered for a refused block.
- **One transaction.** `importProgram` (`src/db/programImport.ts`) plans again
  inside a read-write transaction on exercises and templates, rechecks the
  refusal, then `bulkAdd`s the new exercises and templates: all or nothing.
  Persistent storage is requested first, as for the other imports.
- Logic lives in `src/db` (`programFormat.ts`, `programImport.ts`) and the
  flow in `src/hooks/useProgramImport.ts`; `ProgramImport.tsx` only renders.

## Consequences

- Deleting an imported block's templates one by one is tedious; a "delete
  this block's templates" action is a follow-up if re-importing is common.
- A generator must keep `programId` stable across blocks for history to
  group; nothing can check that.
- Supersets, per-set rest, RPE targets and exercise attributes are not in
  version 1; adding optional fields is a compatible change, renaming one
  needs `formatVersion` 2.
- The file is read whole into memory, which is why it is capped at 2 MB
  before reading; programs are small.
