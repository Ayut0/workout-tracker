# workout-tracker — Context

The domain language of this repo. Use these terms in code, issues and docs.

## Glossary

**Exercise** — A movement in the library, such as "Bench Press (Barbell)".
Names are unique ignoring case and spacing. An exercise that history refers to
is archived (hidden from the library) instead of deleted. An archived exercise
keeps its name and can be restored. Each exercise has a **measure**, what its
sets record: weight and reps (the default), reps only, seconds, or distance.
An exercise may also have **attributes**, all optional and from fixed lists:
**primary muscles** and **secondary muscles** (muscle groups such as chest,
lats or quads; a muscle is one or the other, never both), a **movement
pattern** (squat, hinge, horizontal push, vertical pull…), a **category**
(strength, power, agility, mobility, core) and **equipment** (barbell,
dumbbell, machine, cable, bodyweight, other). Equipment is meant to
decide the progression increment when set, otherwise the name's suffix does;
that takes effect once the progression suggestions use `deriveIncrementKg`
(a later change), not yet.

**Workout** — One training session: a name, a start time, an end time once
finished, and notes. A workout with no end time is in progress (the active
workout). It holds exercises in order, each with its sets in order.

**Set** — One round of an exercise in a workout: weight, reps, and optionally
distance, seconds, RPE and notes. The exercise's measure decides which of
weight, reps, seconds and distance a set shows and is logged by; changing the
measure hides values already logged but keeps them. A set is complete once
marked done; only complete sets count towards Volume and Estimated 1RM, which
use weight × reps alone, so a reps, seconds or distance set adds nothing.

**Template** — A reusable plan for a workout: exercises in order, each with
planned sets (weight and reps, or reps, seconds or distance, following the
exercise's measure).

**Estimated 1RM** — The heaviest single rep a set suggests the lifter could do,
computed from its weight and reps by Epley: weight × (1 + reps / 30). A single
rep is the weight itself. Reps above 12 count as 12, because Epley overstates
the 1RM of high-rep sets; the cap keeps it conservative. A set with 0 reps, or
with no weight or 0 kg (bodyweight), has no Estimated 1RM.

**Volume** — The work done for an exercise in a workout: the sum of weight × reps
over its complete sets (all reps, no cap). Bodyweight sets add nothing.

**Progression** — The suggestion for an exercise's next workout from its last
one. Its complete working sets (warm-ups never count) are judged in groups
sharing a rep range: when every set of a group reached the top of the range,
add the increment (2.5 kg barbell or machine, 2 kg per dumbbell); when any
fell below the bottom, keep the weight; otherwise keep the weight and aim for
one more rep. Bodyweight sets (0 kg) get no suggestion. A deload keeps two
thirds of the exercise's sets at the same weights.

**Rest** — The pause after a set before the next one, timed by the rest timer.
The default rest is a setting; an exercise may set its own rest, which wins
over the default.

**Body log** — Body weight and waist measured on a day. At most one entry per
local calendar day; either measurement may be left out. Saving a day again
replaces its measurements.

## Units

Weight is stored in kilograms and distance in metres. The weight unit setting
(kg or lb) only changes display and input; it applies to body weight too.
Waist is stored and shown in centimetres.

Weights are shown to one decimal place (100 kg is 220.5 lb); suggested weights
round to what a bar can be loaded with (2.5 kg or 5 lb). Stored values are
never rounded.
