import {
	DEFAULT_SET_MEASURE,
	MEASURE_FIELDS,
	type SetMeasure,
	type WeightUnit,
	type WorkoutSet,
} from "../db/types";
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
	"weightKg" | "reps" | "seconds" | "distanceM"
>;

/**
 * A previous set in the user's unit, showing only what the exercise's measure
 * records. For weight and reps: "100 kg × 5", or "100 kg" or "5 reps" when
 * only one was recorded; for the others "12 reps", "45 s" or "400 m".
 * Undefined when the set has none of the measure's fields, which the column
 * shows as "–".
 */
export function formatPreviousSet(
	set: PreviousSet,
	unit: WeightUnit,
	measure: SetMeasure = DEFAULT_SET_MEASURE,
): string | undefined {
	const { weightKg, reps, seconds, distanceM } = set;
	switch (measure) {
		case "weight-reps":
			if (weightKg !== undefined && reps !== undefined) {
				return `${formatWeight(weightKg, unit)} × ${reps}`;
			}
			if (weightKg !== undefined) return formatWeight(weightKg, unit);
			return reps === undefined ? undefined : formatReps(reps);
		case "reps":
			return reps === undefined ? undefined : formatReps(reps);
		case "seconds":
			return seconds === undefined ? undefined : formatSetSeconds(seconds);
		case "distance":
			return distanceM === undefined ? undefined : formatDistance(distanceM);
	}
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
