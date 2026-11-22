import { DEFAULT_SET_MEASURE, MEASURE_FIELDS } from "../db/constants";
import type { SetMeasure, WeightUnit, WorkoutSet } from "../db/types";
import type { SetChanges } from "../db/workoutLog";
import { formatDistance, formatSetSeconds } from "./setMeasure";
import { formatWeight } from "./units";

/**
 * The Previous column (#28): how a set done last time is shown, and what
 * tapping it writes into today's set. The sets themselves come from
 * `listPreviousSets` in src/db. Both follow the exercise's measure (ADR-0012).
 */

/** The measurements of a previous set that the column shows and fills. */
export type PreviousSet = Pick<
	WorkoutSet,
	"weightKg" | "reps" | "seconds" | "distanceM" | "warmup"
>;

/**
 * A previous set in the user's unit, showing only what the exercise's measure
 * records. For weight and reps: "100 kg × 5", or "100 kg" or "5 reps" when
 * only one was recorded; for the others "12 reps", "45 s" or "400 m".
 * Undefined when the set has none of the measure's fields, which the column
 * shows as "–". A past warm-up is prefixed "W " (e.g. "W 40 kg × 10"): the
 * column keeps warm-ups so set N lines up (ADR-0012), but tapping it fills a
 * working set, so the hint must not pass as one.
 */
export function formatPreviousSet(
	set: PreviousSet,
	unit: WeightUnit,
	measure: SetMeasure = DEFAULT_SET_MEASURE,
): string | undefined {
	const text = formatMeasure(set, unit, measure);
	return text !== undefined && set.warmup ? `W ${text}` : text;
}

function formatMeasure(
	set: PreviousSet,
	unit: WeightUnit,
	measure: SetMeasure,
): string | undefined {
	const { weightKg, reps, seconds, distanceM } = set;
	switch (measure) {
		case "weight-reps":
			if (weightKg !== undefined && reps !== undefined) {
				return `${formatWeight(weightKg, unit)} × ${reps}`;
			}
			if (weightKg !== undefined) return formatWeight(weightKg, unit);
			return formatIfPresent(reps, formatReps);
		case "reps":
			return formatIfPresent(reps, formatReps);
		case "seconds":
			return formatIfPresent(seconds, formatSetSeconds);
		case "distance":
			return formatIfPresent(distanceM, formatDistance);
	}
}

/** Formats a measurement, or gives undefined when it was not recorded. */
function formatIfPresent<T>(
	value: T | undefined,
	format: (value: T) => string,
): string | undefined {
	return value === undefined ? undefined : format(value);
}

function formatReps(reps: number): string {
	return `${reps} ${reps === 1 ? "rep" : "reps"}`;
}

/**
 * The changes that copy a previous set's measurements into today's set: only
 * the fields the exercise's measure shows. The stored values are copied as
 * they are, never rounded through the display unit; a measurement the
 * previous set lacks is left unchanged.
 */
export function planFillFromPrevious(
	set: PreviousSet,
	measure: SetMeasure = DEFAULT_SET_MEASURE,
): SetChanges {
	const changes: SetChanges = {};
	for (const field of MEASURE_FIELDS[measure]) {
		const value = set[field];
		if (value !== undefined) changes[field] = value;
	}
	return changes;
}
