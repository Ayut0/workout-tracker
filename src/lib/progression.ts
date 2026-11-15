import type { WeightUnit } from "../db/types";
import {
	convertFromKg,
	convertToKg,
	PLATE_INCREMENT,
	roundToPlateIncrement,
} from "./units";

/**
 * Progression (#70, ADR-0013): what to lift next time for an exercise, from
 * the sets done for it in the last workout. Pure: the caller loads the sets.
 */

/**
 * The parts of a set the rule reads. A subset of WorkoutSet, with the fields
 * #65 (`warmup`) and #69 (`repMin`, `repMax`) add to it, so stored sets can be
 * passed as they are.
 */
export interface ProgressionSet {
	weightKg?: number;
	reps?: number;
	/** Warm-up sets never count. */
	warmup?: boolean;
	/** The set's own rep range; wins over the exercise's. */
	repMin?: number;
	repMax?: number;
	/** Only complete sets count. */
	completedAt?: number;
	/** Recorded but not used by the rule. */
	rpe?: number;
}

export interface ProgressionInput {
	/** The last workout's sets for the exercise, in order. */
	sets: ProgressionSet[];
	/** The exercise's rep range, for sets that carry none. */
	repMin?: number | undefined;
	repMax?: number | undefined;
	/** How much a raise adds, in kilograms; see deriveIncrementKg. */
	incrementKg: number;
	/** The weight unit setting; a raised weight is loadable in it. Default kg. */
	unit?: WeightUnit | undefined;
	/** A deload week: two thirds of the sets at the same weights and reps. */
	deload?: boolean | undefined;
}

/**
 * - increase: every set reached repMax; add the increment, start at repMin.
 * - keep: a set fell below repMin; repeat the weights and reps.
 * - addRep: keep the weights and aim for one more rep per set, up to repMax.
 * - deload: two thirds of the sets at the same weights and reps.
 */
export type ProgressionAction = "increase" | "keep" | "addRep" | "deload";

export interface SuggestedSet {
	weightKg: number;
	reps: number;
}

export interface Suggestion {
	action: ProgressionAction;
	sets: SuggestedSet[];
}

/**
 * Consecutive working sets sharing a rep range, judged together: e.g. heavy
 * sets (4–6) and back-off sets (8–10) of one exercise.
 */
export interface ProgressionGroup {
	repMin: number | undefined;
	repMax: number | undefined;
	/** The group's sets from the last workout. */
	sets: ProgressionSet[];
	/** None without a rep range, or when a set lacks weight or reps. */
	suggestion: Suggestion | undefined;
}

/** The share of a group's sets kept on a deload. */
const DELOAD_SET_SHARE = 2 / 3;

/** Per dumbbell, in kilograms. */
const DUMBBELL_INCREMENT_KG = 2;

const DUMBBELL_SUFFIX = /\(dumbbell\)\s*$/i;

/**
 * The increment for an exercise, in kilograms, from its name's equipment
 * suffix: 2 kg per dumbbell for "(Dumbbell)", otherwise (barbell, machine,
 * anything else) one plate step, 2.5 kg. In pounds every step is 5 lb.
 */
export function deriveIncrementKg(
	exerciseName: string,
	unit: WeightUnit = "kg",
): number {
	if (unit === "kg" && DUMBBELL_SUFFIX.test(exerciseName)) {
		return DUMBBELL_INCREMENT_KG;
	}
	return convertToKg(PLATE_INCREMENT[unit], unit);
}

/**
 * Suggests the next workout's sets for one exercise, group by group. Only
 * complete, non-warm-up sets count; a group is raised only when all of its
 * sets reached repMax, never because of a single set.
 */
export function suggestProgression(
	input: ProgressionInput,
): ProgressionGroup[] {
	const working = input.sets.filter(
		(set) => set.completedAt !== undefined && !set.warmup,
	);
	return groupByRange(working, input).map((group) => ({
		...group,
		suggestion: suggestForGroup(group, input),
	}));
}

function groupByRange(
	sets: ProgressionSet[],
	input: ProgressionInput,
): ProgressionGroup[] {
	const groups: ProgressionGroup[] = [];
	for (const set of sets) {
		const repMin = set.repMin ?? input.repMin;
		const repMax = set.repMax ?? input.repMax;
		const last = groups.at(-1);
		if (last && last.repMin === repMin && last.repMax === repMax) {
			last.sets.push(set);
		} else {
			groups.push({ repMin, repMax, sets: [set], suggestion: undefined });
		}
	}
	return groups;
}

function suggestForGroup(
	group: ProgressionGroup,
	input: ProgressionInput,
): Suggestion | undefined {
	const { repMin, repMax } = group;
	if (repMin === undefined || repMax === undefined) return undefined;
	const done: SuggestedSet[] = [];
	for (const { weightKg, reps } of group.sets) {
		if (weightKg === undefined || reps === undefined) return undefined;
		done.push({ weightKg, reps });
	}

	if (input.deload) {
		const count = Math.max(1, Math.round(done.length * DELOAD_SET_SHARE));
		return { action: "deload", sets: done.slice(0, count) };
	}
	if (done.every((set) => set.reps >= repMax)) {
		const unit = input.unit ?? "kg";
		return {
			action: "increase",
			sets: done.map((set) => ({
				weightKg: raiseWeight(set.weightKg, input.incrementKg, unit),
				reps: repMin,
			})),
		};
	}
	if (done.some((set) => set.reps < repMin)) {
		return { action: "keep", sets: done };
	}
	return {
		action: "addRep",
		sets: done.map((set) => ({
			weightKg: set.weightKg,
			reps: Math.min(set.reps + 1, repMax),
		})),
	};
}

/**
 * The weight plus the increment, rounded to a multiple of the increment in
 * the user's unit so it can be loaded. Always above the weight, since the
 * rounding moves it by at most half an increment.
 */
function raiseWeight(
	kg: number,
	incrementKg: number,
	unit: WeightUnit,
): number {
	return roundToPlateIncrement(
		kg + incrementKg,
		unit,
		convertFromKg(incrementKg, unit),
	);
}
