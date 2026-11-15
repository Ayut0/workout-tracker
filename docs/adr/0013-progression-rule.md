# 0013. Progression rule: a pure function over the last workout's sets

- Status: accepted
- Date: 2026-11-15

## Context

#70 asks the app to suggest the next weight and reps for an exercise from the
last completed workout, by a double-progression rule: raise the weight once
every working set reaches the top of its rep range, otherwise keep the weight
(and add a rep when nothing fell below the range). Warm-ups (#65) and per-set
rep ranges copied from templates (#69) are being added in parallel, so the
input has to fit records that may or may not carry them. Several details were
left open.

## Decision

- **Pure function in `src/lib/progression.ts`** (`suggestProgression`), no
  Dexie or React. Its input set shape `{ weightKg?, reps?, warmup?, repMin?,
  repMax?, completedAt?, rpe? }` is defined there, a subset of `WorkoutSet`
  once #65 and #69 land, so stored sets pass in as they are.
- **Which sets count:** only complete (`completedAt` set), non-warm-up sets.
  RPE is accepted but not used.
- **Groups by per-set rep range.** Each set may carry its own `repMin`/`repMax`
  (#69); a set without one takes the exercise's range. Consecutive sets with
  the same range form a group (heavy 3×4–6, then back-off ×8–10), and each
  group is judged on its own with the same rule; a group is raised only when
  all its sets reached `repMax`, never because of one set.
- **The rule per group:** all at `repMax` → *increase*: each set's weight plus
  the increment, reps back to `repMin`. Any below `repMin` → *keep*: repeat
  the weights and reps. Otherwise → *addRep*: same weights, each set's reps
  plus one, capped at `repMax`.
- **No suggestion** for a group with no rep range, or with a set lacking a
  weight or reps (bodyweight progression is left for later). The group is
  still returned, so a caller can line groups up with the sets.
- **Increment is an explicit input** (`incrementKg`). `deriveIncrementKg`
  derives it from the name's equipment suffix: "(Dumbbell)" 2 kg per
  dumbbell; "(Barbell)", "(Machine)" and anything else 2.5 kg. In pounds every
  step is 5 lb (dumbbells included, as pound dumbbells step by 5 lb). A later
  per-exercise increment setting can replace the helper without changing the
  rule.
- **Rounding:** a raised weight is rounded to a multiple of the increment in
  the user's weight unit (CONTEXT.md § Units), via `roundToPlateIncrement`;
  e.g. 100 kg in pounds (220.46 lb) + 5 lb suggests 225 lb. Kept weights are
  returned exactly as stored, never rounded.
- **Deload is an explicit boolean input** (week 4 of the cycle). It overrides
  the rule: each group keeps the first two thirds of its sets (rounded, at
  least one) at the same weights and reps. Which week is a deload is the
  caller's business.

## Consequences

- No schema change; nothing is stored. The UI that shows suggestions, and
  how the last workout's sets are loaded, are follow-ups.
- Rounding to the increment can land a raise anywhere from half to one and a
  half increments above an odd weight (e.g. 101 kg → 102.5 kg).
