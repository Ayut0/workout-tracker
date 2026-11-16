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
  RPE is accepted but not used. Incomplete sets are dropped before judging, so
  an exercise abandoned part-way is judged on the sets that were completed and
  can still earn a raise (e.g. two sets at `repMax` of three planned). This is
  deliberate: #71 only ever feeds completed sets, so the rule cannot tell an
  abandoned set from one never planned.
- **Groups by per-set rep range.** Each set may carry its own `repMin`/`repMax`
  (#69); the set's range counts only when it has both ends, otherwise it takes
  the exercise's range. Working sets with the same range form a group
  wherever they sit in the exercise (heavy 4–6, back-off 8–10, heavy 4–6 is
  two groups, the heavy one holding both heavy sets). Groups appear in order
  of first appearance, sets keep their original order within one. Each group
  is judged on its own with the same rule; a group is raised only when all its
  sets reached `repMax`, never because of one set.
- **The rule per group:** all at `repMax` → *increase*: each set's weight plus
  the increment, reps back to `repMin`. Any below `repMin` → *keep*: repeat
  the weights and reps. Otherwise → *addRep*: same weights, each set's reps
  plus one, capped at `repMax`.
- **No suggestion** for a group with no rep range (a deload excepted), or with
  a set lacking a weight or reps, or at 0 kg: a 0 kg set is bodyweight
  (CONTEXT.md § Estimated 1RM), treated like a missing weight, since
  bodyweight progression is left for later. The group is still returned, so a
  caller can line groups up with the sets.
- **Increment is an explicit input** (`incrementKg`). `deriveIncrementKg`
  derives it from the name's equipment mark, "(Dumbbell)" anywhere in the name
  (case-insensitive): 2 kg per dumbbell; "(Barbell)", "(Machine)" and anything
  else 2.5 kg. In pounds every step is 5 lb (dumbbells included, as pound
  dumbbells step by 5 lb). A later per-exercise increment setting can replace
  the helper without changing the rule. A zero, negative or non-finite
  increment cannot raise anything: the group is *keep* instead of a raise.
- **Rounding:** the raised weight is the weight plus the increment, rounded to
  the unit's plate grid (`PLATE_INCREMENT`: 2.5 kg, 5 lb) via
  `roundToPlateIncrement`, so the grid comes from the unit, not from
  `incrementKg`; e.g. 100 kg in pounds (220.46 lb) + 5 lb suggests 225 lb. The
  exception is a kilogram increment that is not whole plate steps (2 kg per
  dumbbell): the sum is returned as it is, so 5 → 7, 12.5 → 14.5 kg, off the
  barbell grid. Kept weights are returned exactly as stored, never rounded.
- **Deload is an explicit boolean input** (week 4 of the cycle). It overrides
  the rule and needs no rep range. It takes two thirds of the exercise's
  working sets (rounded, at least one): the first sets in their original
  order, at the same weights and reps. Each group reports the kept sets that
  belong to it; a group left with none still gets a *deload* suggestion with
  an empty list. Which week is a deload is the caller's business.

## Consequences

- No schema change; nothing is stored. The UI that shows suggestions, and
  how the last workout's sets are loaded, are follow-ups.
- Rounding to the plate grid can land a barbell raise anywhere from half to
  one and a half increments above an odd weight (e.g. 101 kg → 102.5 kg).
