import type { WeightUnit, WorkoutSet } from "../db/types";
import type { SetChanges } from "../db/workoutLog";
import { formatWeight } from "./units";

/**
 * The Previous column (#28): how a set done last time is shown, and what
 * tapping it writes into today's set. The sets themselves come from
 * `listPreviousSets` in src/db.
 */

/** The measurements of a previous set that the column shows and fills. */
export type PreviousSet = Pick<WorkoutSet, "weightKg" | "reps">;

/**
 * A previous set in the user's unit: "100 kg × 5", or "100 kg" or "5 reps"
 * when only one was recorded. Undefined when it has neither (e.g. a cardio
 * set with only distance or time), which the column shows as "–".
 */
export function formatPreviousSet(
	set: PreviousSet,
	unit: WeightUnit,
): string | undefined {
	const { weightKg, reps } = set;
	if (weightKg !== undefined && reps !== undefined) {
		return `${formatWeight(weightKg, unit)} × ${reps}`;
	}
	if (weightKg !== undefined) return formatWeight(weightKg, unit);
	if (reps !== undefined) return `${reps} ${reps === 1 ? "rep" : "reps"}`;
	return undefined;
}

/**
 * The changes that copy a previous set's weight and reps into today's set.
 * The stored kilograms are copied as they are, never rounded through the
 * display unit; a measurement the previous set lacks is left unchanged.
 */
export function planFillFromPrevious(set: PreviousSet): SetChanges {
	const changes: SetChanges = {};
	if (set.weightKg !== undefined) changes.weightKg = set.weightKg;
	if (set.reps !== undefined) changes.reps = set.reps;
	return changes;
}
