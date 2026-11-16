import type { Equipment, WeightUnit } from "../db/types";
import { convertToKg, PLATE_INCREMENT, roundToPlateIncrement } from "./units";

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
	/** The set's own rep range; wins over the exercise's when both are set. */
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
 * Working sets sharing a rep range, judged together wherever they sit in the
 * exercise: e.g. heavy sets (4–6) and back-off sets (8–10).
 */
export interface ProgressionGroup {
	repMin: number | undefined;
	repMax: number | undefined;
	/** The group's sets from the last workout. */
	sets: ProgressionSet[];
	/** None without a rep range, or when a set lacks weight (or is 0 kg) or reps. A deload needs no range. */
	suggestion: Suggestion | undefined;
}

/** The share of the exercise's working sets kept on a deload. */
const DELOAD_SET_SHARE = 2 / 3;

/** Per dumbbell, in kilograms. */
const DUMBBELL_INCREMENT_KG = 2;

const DUMBBELL_MARK = /\(dumbbell\)/i;

/** The parts of an exercise the increment reads. */
export interface IncrementExercise {
	name: string;
	equipment?: Equipment | undefined;
}

/**
 * The increment for an exercise, in kilograms: 2 kg per dumbbell, otherwise
 * (barbell, machine, anything else) one plate step, 2.5 kg. In pounds every
 * step is 5 lb. The exercise's equipment decides when it has one (ADR-0016);
 * otherwise, or given only a name, "(Dumbbell)" anywhere in the name does.
 */
export function deriveIncrementKg(
	exercise: string | IncrementExercise,
	unit: WeightUnit = "kg",
): number {
	if (unit === "kg" && isDumbbell(exercise)) return DUMBBELL_INCREMENT_KG;
	return convertToKg(PLATE_INCREMENT[unit], unit);
}

function isDumbbell(exercise: string | IncrementExercise): boolean {
	const { name, equipment } =
		typeof exercise === "string" ? { name: exercise } : exercise;
	if (equipment !== undefined) return equipment === "dumbbell";
	return DUMBBELL_MARK.test(name);
}

/**
 * Suggests the next workout's sets for one exercise, group by group. Only
 * complete, non-warm-up sets count; a group is raised only when all of its
 * sets reached repMax, never because of a single set. A deload takes two
 * thirds of the exercise's working sets, not of each group.
 */
export function suggestProgression(
	input: ProgressionInput,
): ProgressionGroup[] {
	const working = input.sets.filter(
		(set) => set.completedAt !== undefined && !set.warmup,
	);
	const keepCount = input.deload
		? Math.max(1, Math.round(working.length * DELOAD_SET_SHARE))
		: working.length;
	return groupByRange(working, input).map((group) => ({
		repMin: group.repMin,
		repMax: group.repMax,
		sets: group.entries.map((entry) => entry.set),
		suggestion: input.deload
			? deloadGroup(group.entries, keepCount)
			: suggestForGroup(group, input),
	}));
}

interface Entry {
	set: ProgressionSet;
	/** Position among the exercise's working sets. */
	index: number;
}

interface RangeGroup {
	repMin: number | undefined;
	repMax: number | undefined;
	entries: Entry[];
}

/**
 * Groups the working sets by rep range across the whole exercise, in order of
 * first appearance; a group's sets keep their original order. A set's own
 * range counts only when it has both ends, otherwise the exercise's applies.
 */
function groupByRange(
	sets: ProgressionSet[],
	input: ProgressionInput,
): RangeGroup[] {
	const groups = new Map<string, RangeGroup>();
	sets.forEach((set, index) => {
		const own = set.repMin !== undefined && set.repMax !== undefined;
		const repMin = own ? set.repMin : input.repMin;
		const repMax = own ? set.repMax : input.repMax;
		const key = `${repMin ?? ""}-${repMax ?? ""}`;
		const group = groups.get(key);
		if (group) group.entries.push({ set, index });
		else groups.set(key, { repMin, repMax, entries: [{ set, index }] });
	});
	return [...groups.values()];
}

/** A set's weight and reps, or undefined for bodyweight or missing values. */
function loaded(set: ProgressionSet): SuggestedSet | undefined {
	const { weightKg, reps } = set;
	if (weightKg === undefined || reps === undefined) return undefined;
	if (!(weightKg > 0)) return undefined;
	return { weightKg, reps };
}

/**
 * The group's sets among the first `keepCount` working sets of the exercise,
 * at the same weights and reps. Needs no rep range. A group left with no sets
 * still gets a deload suggestion, with an empty list.
 */
function deloadGroup(
	entries: Entry[],
	keepCount: number,
): Suggestion | undefined {
	const sets: SuggestedSet[] = [];
	for (const { set, index } of entries) {
		const one = loaded(set);
		if (one === undefined) return undefined;
		if (index < keepCount) sets.push(one);
	}
	return { action: "deload", sets };
}

function suggestForGroup(
	group: RangeGroup,
	input: ProgressionInput,
): Suggestion | undefined {
	const { repMin, repMax } = group;
	if (repMin === undefined || repMax === undefined) return undefined;
	const done: SuggestedSet[] = [];
	for (const { set } of group.entries) {
		const one = loaded(set);
		if (one === undefined) return undefined;
		done.push(one);
	}

	if (done.every((set) => set.reps >= repMax)) {
		// No usable increment: nothing to raise by, so repeat the sets.
		if (!(input.incrementKg > 0) || !Number.isFinite(input.incrementKg)) {
			return { action: "keep", sets: done };
		}
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
 * The weight plus the increment, rounded to the plate grid of the user's unit
 * (2.5 kg, 5 lb) so it can be loaded, whatever the increment. The exception
 * is a kilogram increment that is not whole plate steps (2 kg per dumbbell):
 * dumbbells come in their own steps, so it is added as it is. Always above
 * the weight.
 */
function raiseWeight(
	kg: number,
	incrementKg: number,
	unit: WeightUnit,
): number {
	const raised = kg + incrementKg;
	if (unit === "kg") {
		const steps = incrementKg / PLATE_INCREMENT.kg;
		if (Math.abs(steps - Math.round(steps)) > 1e-9) return raised;
	}
	const snapped = roundToPlateIncrement(raised, unit);
	return snapped > kg ? snapped : raised;
}
