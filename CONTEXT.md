# workout-tracker — Context

The domain language of this repo. Use these terms in code, issues and docs.

## Glossary

**Exercise** — A movement in the library, such as "Bench Press (Barbell)".
Names are unique ignoring case and spacing. An exercise that history refers to
is archived (hidden from the library) instead of deleted.

**Workout** — One training session: a name, a start time, an end time once
finished, and notes. A workout with no end time is in progress (the active
workout). It holds exercises in order, each with its sets in order.

**Set** — One round of an exercise in a workout: weight, reps, and optionally
distance, seconds, RPE and notes. A set is complete once marked done; only
complete sets count towards Volume and Estimated 1RM.

**Template** — A reusable plan for a workout: exercises in order, each with
planned sets (weight and reps).

**Estimated 1RM** — The heaviest single rep a set suggests the lifter could do,
computed from its weight and reps by Epley: weight × (1 + reps / 30). A single
rep is the weight itself. Reps above 12 count as 12, because Epley overstates
the 1RM of high-rep sets; the cap keeps it conservative. A set with 0 reps, or
with no weight or 0 kg (bodyweight), has no Estimated 1RM.

**Volume** — The work done for an exercise in a workout: the sum of weight × reps
over its complete sets (all reps, no cap). Bodyweight sets add nothing.

## Units

Weight is stored in kilograms and distance in metres. The weight unit setting
(kg or lb) only changes display and input.
