import type { SetMeasure, WeightUnit, WorkoutSet } from "../db/types";
import type { SetUpdate } from "../db/workoutLog";
import { formatRepRange } from "./plannedTargets";
import {
	deriveIncrementKg,
	type IncrementExercise,
	type ProgressionAction,
	type ProgressionSet,
	type SuggestedSet,
	suggestProgression,
} from "./progression";
import { formatWeight } from "./units";

/**
 * Progression suggestions while logging (#71, ADR-0017): what the rule
 * (ADR-0013) suggests for an exercise in the active workout, lined up with
 * today's working sets so one tap can fill them. Pure: the caller loads the
 * last workout's sets (`listPreviousSets`).
 */

/** The parts of today's sets the suggestion reads. */
export type TodaySet = Pick<
	WorkoutSet,
	"id" | "weightKg" | "reps" | "warmup" | "repMin" | "repMax" | "completedAt"
>;

export interface SuggestionInput {
	/** Today's sets of the exercise, in order, warm-ups included. */
	sets: readonly TodaySet[];
	/**
	 * The last finished workout's complete sets of the exercise, in order,
	 * warm-ups included (`listPreviousSets`).
	 */
	previous: readonly ProgressionSet[];
	measure: SetMeasure;
	exercise: IncrementExercise;
	unit: WeightUnit;
}

/** One group's suggestion (e.g. the heavy sets, or the back-off sets). */
export interface ExerciseSuggestion {
	action: ProgressionAction;
	repMin: number;
	repMax: number;
	/** The suggested sets, one per working set the group did last time. */
	sets: SuggestedSet[];
	/**
	 * What "Use" writes: the suggested weight and reps for today's matching
	 * working sets that are not done yet and do not already hold it. Never a
	 * warm-up. Empty once used, which hides the button.
	 */
	fills: SetUpdate[];
}

/**
 * The suggestions for one exercise, group by group; empty without history,
 * or when today's working sets plan no rep range (the exercise was not
 * started from a template), or for a measure without weight and reps.
 *
 * Last workout's working sets are judged with their own rep range; one that
 * has none takes the range of today's working set in the same position, so
 * history logged before ranges existed (or imported) can still be judged
 * against today's plan. Suggested set N of the exercise lines up with today's
 * working set N. Deload is never applied here yet (no block to tell which
 * week is a deload).
 */
export function suggestForExercise(
	input: SuggestionInput,
): ExerciseSuggestion[] {
	if (input.measure !== "weight-reps") return [];
	const todayWorking = input.sets.filter((set) => !set.warmup);
	if (!todayWorking.some(hasRange)) return [];
	const lastWorking = input.previous.filter(
		(set) => set.completedAt !== undefined && !set.warmup,
	);
	const judged = lastWorking.map((set, index): ProgressionSet => {
		const planned = todayWorking[index];
		if (hasRange(set) || !planned || !hasRange(planned)) return set;
		return { ...set, repMin: planned.repMin, repMax: planned.repMax };
	});
	const groups = suggestProgression({
		sets: judged,
		incrementKg: deriveIncrementKg(input.exercise, input.unit),
		unit: input.unit,
		deload: false,
	});

	const suggestions: ExerciseSuggestion[] = [];
	let start = 0;
	for (const { repMin, repMax, sets, suggestion } of groups) {
		if (suggestion && repMin !== undefined && repMax !== undefined) {
			suggestions.push({
				action: suggestion.action,
				repMin,
				repMax,
				sets: suggestion.sets,
				fills: planFills(suggestion.sets, todayWorking.slice(start)),
			});
		}
		start += sets.length;
	}
	return suggestions;
}

function hasRange<T extends { repMin?: number; repMax?: number }>(
	set: T,
): set is T & { repMin: number; repMax: number } {
	return set.repMin !== undefined && set.repMax !== undefined;
}

function planFills(
	suggested: readonly SuggestedSet[],
	today: readonly TodaySet[],
): SetUpdate[] {
	const fills: SetUpdate[] = [];
	for (const [index, { weightKg, reps }] of suggested.entries()) {
		const set = today[index];
		if (!set || set.completedAt !== undefined) continue;
		if (set.weightKg === weightKg && set.reps === reps) continue;
		fills.push({ setId: set.id, changes: { weightKg, reps } });
	}
	return fills;
}

const ACTION_LABELS: Record<ProgressionAction, string> = {
	increase: "Next",
	addRep: "Same weight, aim for +1 rep",
	keep: "Same weight and reps",
	deload: "Deload",
};

/**
 * A suggestion as shown under the exercise, in the user's unit, e.g.
 * "4–6 reps · Next: 72.5 kg × 4 (3 sets)". Repeated sets are counted;
 * different ones are listed in order.
 */
export function describeSuggestion(
	suggestion: Pick<ExerciseSuggestion, "action" | "repMin" | "repMax" | "sets">,
	unit: WeightUnit,
): string {
	const range = formatRepRange(suggestion.repMin, suggestion.repMax);
	const reps = range === "1" ? "rep" : "reps";
	const sets = countRuns(suggestion.sets)
		.map(({ set, count }) => {
			const text = `${formatWeight(set.weightKg, unit)} × ${set.reps}`;
			return count > 1 ? `${text} (${count} sets)` : text;
		})
		.join(", ");
	return `${range} ${reps} · ${ACTION_LABELS[suggestion.action]}: ${sets}`;
}

/** Consecutive equal sets, counted. */
function countRuns(
	sets: readonly SuggestedSet[],
): { set: SuggestedSet; count: number }[] {
	const runs: { set: SuggestedSet; count: number }[] = [];
	for (const set of sets) {
		const run = runs.at(-1);
		if (run && run.set.weightKg === set.weightKg && run.set.reps === set.reps) {
			run.count += 1;
		} else {
			runs.push({ set, count: 1 });
		}
	}
	return runs;
}
