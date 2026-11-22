import type { WeightUnit } from "../db/types";
import type { SetUpdate } from "../db/workoutLog";
import { ACTION_LABELS } from "./constants";
import { formatRepRange } from "./plannedTargets";
import {
	deriveIncrementKg,
	type ProgressionSet,
	type SuggestedSet,
	suggestProgression,
} from "./progression";
import type { ExerciseSuggestion, SuggestionInput, TodaySet } from "./types";
import { convertFromKg, formatWeight, roundForDisplay } from "./units";

/**
 * Progression suggestions while logging (#71, ADR-0017): what the rule
 * (ADR-0013) suggests for an exercise in the active workout, lined up with
 * today's working sets so one tap can fill them. Pure: the caller loads the
 * last workout's sets (`listPreviousSets`).
 */

/**
 * The suggestions for one exercise, one per rep range; empty without history,
 * or when today's working sets plan no rep range (the exercise was not
 * started from a template), or for a measure without weight and reps.
 *
 * Last workout's working sets are judged with their own rep range, all sets
 * sharing a range together (as progression.ts groups them). One without a
 * range takes the range of today's working set in the same position only
 * when last time and today have the same number of working sets, so history
 * logged before ranges existed (or imported) can be judged against today's
 * plan; with different counts positions do not line up and such a set gets no
 * suggestion. A suggestion fills only today's working sets with the same rep
 * range, the N-th suggested set into the N-th such set. Deload is never
 * applied here yet (no block to tell which week is a deload).
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
	const sameShape = lastWorking.length === todayWorking.length;
	const byRange = new Map<string, ProgressionSet[]>();
	for (const [index, set] of lastWorking.entries()) {
		const planned = todayWorking[index];
		const judged: ProgressionSet =
			!hasRange(set) && sameShape && planned && hasRange(planned)
				? { ...set, repMin: planned.repMin, repMax: planned.repMax }
				: set;
		if (!hasRange(judged)) continue;
		const key = rangeKey(judged);
		byRange.set(key, [...(byRange.get(key) ?? []), judged]);
	}

	const incrementKg = deriveIncrementKg(input.exercise, input.unit);
	const suggestions: ExerciseSuggestion[] = [];
	for (const [key, sets] of byRange) {
		const [group] = suggestProgression({
			sets,
			incrementKg,
			unit: input.unit,
			deload: false,
		});
		if (!group?.suggestion) continue;
		const { repMin, repMax, suggestion } = group;
		if (repMin === undefined || repMax === undefined) continue;
		const todaySameRange = todayWorking.filter(
			(set) => hasRange(set) && rangeKey(set) === key,
		);
		suggestions.push({
			action: suggestion.action,
			repMin,
			repMax,
			sets: suggestion.sets,
			fills: planFills(suggestion.sets, todaySameRange, input.unit),
		});
	}
	return suggestions;
}

function hasRange<T extends { repMin?: number; repMax?: number }>(
	set: T,
): set is T & { repMin: number; repMax: number } {
	return set.repMin !== undefined && set.repMax !== undefined;
}

function rangeKey(set: { repMin: number; repMax: number }): string {
	return `${set.repMin}-${set.repMax}`;
}

/**
 * Today's not-done sets of the group's range (never a warm-up: callers pass
 * working sets only) are overwritten with the suggestion: tapping Use is an
 * explicit overwrite, planned or typed values included. A set already
 * showing the suggestion is skipped, compared as displayed in the user's
 * unit, so a pound weight typed as 220.5 (stored 100.0187 kg) counts.
 */
function planFills(
	suggested: readonly SuggestedSet[],
	today: readonly TodaySet[],
	unit: WeightUnit,
): SetUpdate[] {
	const shown = (kg: number | undefined) =>
		kg === undefined ? undefined : roundForDisplay(convertFromKg(kg, unit));
	const fills: SetUpdate[] = [];
	for (const [index, { weightKg, reps }] of suggested.entries()) {
		const set = today[index];
		if (!set || set.completedAt !== undefined) continue;
		if (shown(set.weightKg) === shown(weightKg) && set.reps === reps) continue;
		fills.push({ setId: set.id, changes: { weightKg, reps } });
	}
	return fills;
}

/**
 * The workout exercises that get a suggestion: the first card of each
 * exercise. Last time's sets are joined across an exercise's appearances, so
 * a second card of the same exercise would be lined up from the first set.
 */
export function firstOccurrenceIds(
	entries: readonly { id: string; exerciseId: string }[],
): Set<string> {
	const seen = new Set<string>();
	const first = new Set<string>();
	for (const { id, exerciseId } of entries) {
		if (seen.has(exerciseId)) continue;
		seen.add(exerciseId);
		first.add(id);
	}
	return first;
}

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
