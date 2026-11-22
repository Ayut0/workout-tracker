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
decide the progression increment when set, otherwise the name's "(Dumbbell)" mark does;
that takes effect once the progression suggestions use `deriveIncrementKg`
(a later change), not yet.

**Instructions** — How an exercise is performed, written by the lifter: an
optional text and an optional web link. One per exercise, shared by every
workout and template that uses it, and readable while logging. The app ships
none; the lifter writes their own. Not to be confused with **notes**, which
belong to one workout (or plan) and say what to do or what happened that time.

**Workout** — One training session: a name, a start time, an end time once
finished, and notes. A workout with no end time is in progress (the active
workout). It holds exercises in order, each with its sets in order.

**Set** — One round of an exercise in a workout: weight, reps, and optionally
distance, seconds, RPE and notes. The exercise's measure decides which of
weight, reps, seconds and distance a set shows and is logged by; changing the
measure hides values already logged but keeps them. A set is complete once
marked done. A set may be marked by hand as a **warm-up** ("W"); a set that is
not is a working set. Only complete working sets count towards Volume,
Estimated 1RM, personal records and progression, which use weight × reps
alone, so a warm-up, or a reps, seconds or distance set, adds nothing. Only
`true` is stored for the mark. The Previous column keeps a past warm-up but
shows it as "W 40 kg × 10", since tapping it fills a working set.

**Template** — A reusable plan for a workout: exercises in order, each with
planned sets (weight and reps, or reps, seconds or distance, following the
exercise's measure) and optional notes, cues such as "seat 4". A planned set
may be a warm-up; starting a workout from the template, and saving a workout
as a template, keep the mark. A planned set whose measure counts reps may also
have **targets**: a rep range (such as 4–6, or a single number such as 8) and
a target RIR, the reps to leave in reserve. Starting a workout from a template
copies its exercises, sets, targets and notes into the workout, so the notes
and targets show read-only while logging, and Progression reads a set's rep
range from the set itself. A set added during a workout has no targets: only
the template plans them. The workout also records which template it came
from, as a snapshot: editing or deleting the template never changes it.

**Program** — A plan of several weeks, made outside the app and imported as
templates: **blocks** (from 1) of **weeks** (from 1 within the block), each
week of **days** ("A", "B"). Importing a program file adds one template per
week and day and never changes what is stored; a block already imported is
refused. A template made from a program knows its
program, block, week and day, and whether the week is a **deload**; a workout
started from it records the same, shown as "Week 2 · Block 1 · Day A" (the
day only when it has one).

**Estimated 1RM** — The heaviest single rep a set suggests the lifter could do,
computed from its weight and reps by Epley: weight × (1 + reps / 30). A single
rep is the weight itself. Reps above 12 count as 12, because Epley overstates
the 1RM of high-rep sets; the cap keeps it conservative. A warm-up, a set with
0 reps, or with no weight or 0 kg (bodyweight), has no Estimated 1RM.

**Volume** — The work done for an exercise in a workout: the sum of weight × reps
over its complete working sets (all reps, no cap). Warm-ups and bodyweight
sets add nothing.

**Week** — Monday 00:00 to the next Monday 00:00, local time. A workout
belongs to the week it started in (its start time), even if it ends or has
sets done after midnight into the next week. Weeks are counted in calendar
days, so a week is 167 or 169 hours across a daylight-saving change. Where a
change skips midnight (e.g. Havana, Cairo, Santiago, Beirut), the Monday's
first instant (01:00) starts the week; weeks always tile the time line, so
every instant is in exactly one week. The weekly-sets screen follows the
clock: "this week" rolls over at the new week's start.

**Hard sets** (weekly sets per muscle group) — How many sets each muscle group
got in a Week, by fractional counting (Pelland et al. 2025): every complete
working set counts 1 for each of its exercise's primary muscles
and 0.5 for each secondary muscle, so counts are whole or half numbers. Unlike
Volume, a complete working set counts whatever the exercise's measure (weight and reps, reps, seconds or
distance) and whatever its weight, reps or RPE. Sets of exercises with no
muscles set count towards nothing. The active workout counts too, as its sets
are completed.

**Progression** — The suggestion for an exercise's next workout from its last
one. Its complete working sets (warm-ups never count) are judged in groups
sharing a rep range: when every set of a group reached the top of the range,
add the increment (2.5 kg barbell or machine, 2 kg per dumbbell); when any
fell below the bottom, keep the weight; otherwise keep the weight and aim for
one more rep. Bodyweight sets (0 kg) get no suggestion. A deload keeps two
thirds of the exercise's sets at the same weights.
While logging, an exercise whose working sets carry a planned rep range
shows its suggestion; "Use" fills today's working sets with it, never the
warm-ups.

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
