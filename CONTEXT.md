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
computed from its weight and reps. The formula is chosen in #35 and recorded
here.

**Volume** — The work done for an exercise in a workout: the sum of weight × reps
over its complete sets.

**Rest** — The pause after a set before the next one, timed by the rest timer.
The default rest is a setting; an exercise may set its own rest, which wins
over the default.

## Units

Weight is stored in kilograms and distance in metres. The weight unit setting
(kg or lb) only changes display and input.

Weights are shown to one decimal place (100 kg is 220.5 lb); suggested weights
round to what a bar can be loaded with (2.5 kg or 5 lb). Stored values are
never rounded.
