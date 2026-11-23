# 0020. Exercise instructions: a lifter-written text and link per exercise

- Status: accepted
- Date: 2026-11-22

## Context

#97 asks for a way to read how an exercise is performed while logging it,
offline and with no server. The lifter writes the instructions themselves;
the app ships none (no exercise wording in the repo). The feature lands in
three PRs: data and backup (#98), the library form (#99) and the workout
card (#100). This record covers what all three rely on: what is stored, the
rules for it, and how a backup is checked.

## Decision

- **Stored on the exercise, optional, not indexed:** `instructions?: string`
  (plain text) and `instructionsUrl?: string` (a web link), as
  `ExerciseInstructions`. Nothing queries by them, so there is no Dexie
  version (ADR-0002). An exercise without instructions is the same record as
  before #97.
- **One set of rules, in `src/db/instructions.ts`,** shared by the form and
  the backup check, so a restore accepts exactly what the app can save.
  `src/db` cannot import `src/lib`, which is why the rules live in `src/db`.
  - Text: trimmed at the ends, inner line breaks kept, plain text only (never
    rendered as HTML or Markdown), at most 2,000 characters after trimming.
  - Link: trimmed, at most 2,000 characters, and a full `http:` or `https:`
    URL with a host, checked with `new URL`. No `https://` is added to a bare
    "example.com/x"; it is rejected so the lifter sees what will be opened.
  - Blank after trimming means not stored: clearing a field removes it.
- **Only http and https links, ever.** The link is opened by a tap, so a
  `javascript:` or `data:` URL stored in the record would run in the app's
  origin. The rule is enforced when saving and when restoring, and #100
  checks it again before rendering a link (defence in depth: a record could
  predate the rule or be written by other code). A link is never fetched,
  embedded or previewed; it opens in a new tab with `rel="noopener noreferrer"`.
- **Written by `setExerciseInstructions`** inside one Dexie update that sets
  or removes just those two fields, so a concurrent edit of the exercise's
  attributes (ADR-0016) is kept.
- **Backups:** the exercise spec in `backupFormat.ts` gains both fields as
  optional. A non-string, text over the cap, or a link the app could not
  save (wrong scheme, no host, too long) rejects the whole file, like any
  other invalid field. Blank values are trimmed away on restore rather than
  rejected, as blank notes are (ADR-0014). Backups made before #97 have
  neither field and restore unchanged. The Strong import is untouched.

## Consequences

- Instructions are shared by every workout and template that uses the
  exercise; editing them changes what every one of those shows.
- A backup holding a non-web link (hand-edited, or from a future version
  with looser rules) is rejected rather than partly restored; the error names
  the exercise field.
- Not shown in History, the exercise picker or the template editor; adding
  them there later needs no data change.
