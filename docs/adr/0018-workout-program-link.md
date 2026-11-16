# 0018. Link a workout to the template and program it came from

- Status: accepted
- Date: 2026-11-15
- Supersedes in part: ADR-0010 ("Starting copies": nothing links the workout
  back to the template)

## Context

ADR-0010 decided that starting a workout from a template copies the
template's exercises and sets and keeps no link back. ADR-0014 kept to that by
copying notes and planned targets onto the workout. Three planned features now
need to know where a workout sits in a training program: the progression rule
needs to know a deload week (ADR-0013 takes `deload` as an input and leaves
"which week" to the caller), per-block analysis needs to group workouts by
block, and the program import (#76) creates templates per program, block,
week and day. #74 decides what is linked, what happens when the template is
edited or deleted, and whether anything is indexed. Adding an index would be
a Dexie version, an Escalation trigger (AGENTS.md); this ADR avoids one.

## Decision

- **A snapshot, not a reference.** A workout started from a template records
  `Workout.source?: { templateId, templateName, program? }` as the template
  was at that moment. `program` is a `ProgramLink`:
  `{ programId, programName, block, week, day?, deload? }`. The snapshot is
  what history keeps; `templateId` is kept for "last performed" lookups but
  nothing requires the template to still exist.
- **Templates carry the program.** `Template.program?: ProgramLink` says which
  program, block (from 1), week of the block (from 1) and day ("A") the
  template plans, and whether that week is a deload. A program import (#76)
  sets it; the template editor does not edit it, and `updateTemplate` keeps it
  when the name or exercises change. A template made by hand or saved from a
  workout has none, so a workout started from it records only the template.
- **Exercises and sets are still copied** exactly as ADR-0010 and ADR-0014
  say: the link adds where the workout came from; it does not make the
  workout read anything from the template.
- **Editing or deleting the template changes nothing in history.** The
  workout keeps the name, program, block and week it was started with.
  `deleteTemplate` stays a plain delete (ADR-0010) and does not touch
  workouts. Grouping goes by `programId`, so the workouts of every block of
  a program stay together whatever happens to its templates.
- **Nothing is indexed.** Both fields are optional and not indexed, so there
  is no Dexie version (ADR-0002). Per-block or per-program queries scan the
  workouts store: one lifter's history is a few hundred workouts, and the
  analysis screens already read every workout of a range. An index on
  `source.program.programId` can come with a new version if a query ever
  needs it.
- **Only a workout started from a template records a source.** A workout
  started empty, imported from Strong or restored from an older backup has
  none. Renaming a workout does not change its `source.templateName`.
- **Shown read-only.** The active workout and a past workout show
  "Week 2 · Block 1 · Day A" under the name (the day only when the link has
  one, then " · Deload" in a deload week; `describeProgramLink` in
  `src/lib/programLink.ts`). The day is shown so two days of one week are
  told apart; the program's name is kept in the snapshot but not shown, to
  keep the line short, and a workout whose source has no program shows
  nothing about its template (it is usually named after it). Only the active
  and past workout screens show it. There is no way to set or change the
  link by hand in the MVP.
- **Backup** (ADR-0011): `parseBackup` checks `Workout.source` (template id,
  name, optional program) and `Template.program` (program id, name, `block`
  and `week` whole numbers from 1, optional `day` text and `deload` flag).
  Backups made before #74 have neither and restore unchanged; the backup
  schema version is not bumped, as the stored shape only gains optional
  fields.

## Consequences

- **Follow-up for the progression suggestions (ADR-0017, #71).** They still
  use the proxy "working sets have a planned rep range" to tell a workout
  came from a template, and always pass `deload: false`. With this link the
  proxy can become an explicit `source !== undefined` check, and `deload`
  can be read from `source.program.deload` of the workout in progress. This
  change leaves #71's code as it is; wiring it is a separate change.
- A snapshot can go stale on purpose: renaming the program later does not
  rename it in past workouts.
- A template edited after an import still says it plans "Week 2 · Block 1"
  even if its exercises no longer match the file; the lifter edited it.
- Scanning workouts for a block is linear in history size; fine for years of
  one lifter's training, revisit with an index if it shows up in profiling.
