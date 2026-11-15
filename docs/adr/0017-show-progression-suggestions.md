# 0017. Show Progression suggestions while logging

- Status: accepted
- Date: 2026-11-15

## Context

ADR-0013 added the Progression rule as a pure function but no UI. #71 asks
for each exercise's suggestion ("Next: 72.5 kg × 4", "Same weight, aim for +1
rep") to show when a workout starts from a template, judged on the last
finished workout containing the exercise. Workouts do not yet record which
template (or training block) they were started from: #74 is adding that link
in parallel. Open questions: show beside the planned values or pre-fill the
sets; which rep range judges history; how to tell a workout came from a
template; deload.

## Decision

- **Show, then fill on one tap; never pre-fill.** Each exercise card shows
  one line per rep-range group under its notes, e.g.
  "4–6 reps · Next: 72.5 kg × 4 (3 sets)" and, for back-off sets,
  "8–10 reps · Same weight, aim for +1 rep: 60 kg × 9 (2 sets)". A "Use"
  button beside the line writes the suggested weight and reps into today's
  matching working sets in one transaction (`updateSets`). The planned
  values stay until the lifter taps Use, and typing overrides either.
  Pre-filling at start would silently overwrite the template's plan and
  could not be told apart from what the lifter typed.
- **Warm-ups keep their planned values.** Warm-ups are left out on both
  sides: last time's are never judged (ADR-0013) and today's are never
  filled. Today's sets already marked done are not filled either, so Use
  never rewrites what was lifted. Sets that already hold the suggestion are
  not filled, so the button goes away once used.
- **Lining up.** Suggested working set N lines up with today's working set N
  (warm-ups skipped on both sides), as the Previous column lines sets up by
  position. Extra suggested sets with no set today are shown but not filled;
  extra sets today are left alone.
- **Which history.** The last finished workout with a complete set of the
  exercise, via the existing `listPreviousSets` (the Previous column's
  query), which already leaves out the active workout and keeps each set's
  warm-up mark and rep range. No new query; a test pins the fields it keeps.
- **Which rep range.** A last-workout set judged with its own range (copied
  from its template, ADR-0014), because that is what it aimed for. A set
  without one (logged before ranges existed, imported from Strong, or added
  without a template) takes the range of today's working set in the same
  position, so the first workout from a new template already gets a
  suggestion from older history. A set with neither gets none.
- **"Started from a template" proxy.** Until #74 links a workout to its
  template, suggestions show for an exercise whose working sets today carry
  a planned rep range, which only a template copies in (ADR-0014). An
  exercise added by hand, or a template set without a range, shows nothing.
- **No suggestion** without history, with no range on either side, for a
  measure other than weight and reps, or for a group with a set missing its
  weight or reps (bodyweight progression is left for later, ADR-0013).
- **Deload is always off** (`deload: false`). Which week is a deload depends
  on a training block, which #74 introduces; wiring it is a follow-up.
- **Units.** Weights show in the weight unit setting; raised weights are
  already rounded to what loads in that unit (2.5 kg or 5 lb, 2 kg per
  dumbbell) by the rule. Use stores the suggested kilograms; kept weights
  are copied as stored, never rounded through the display unit.
- **Layers.** `suggestForExercise` and `describeSuggestion` are pure, in
  `src/lib/suggestions.ts`; `updateSets` is in `src/db/workoutLog.ts`;
  `useProgressionSuggestions` combines the active workout with
  `usePreviousSets`; `ProgressionSuggestions` only renders and emits Use.

## Consequences

- No schema change; nothing new is stored.
- If an exercise appears twice in a workout, each card is judged against the
  same joined history (as the Previous column is).
- Once #74 links workouts to templates and blocks, the proxy can become an
  explicit check and deload weeks can pass `deload: true`.
