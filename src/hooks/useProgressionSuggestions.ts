import { useMemo } from "react";
import type { WeightUnit, WorkoutSet } from "../db/types";
import { resolveMeasure } from "../db/workoutLog";
import {
	type ExerciseSuggestion,
	suggestForExercise,
} from "../lib/suggestions";
import type { ActiveWorkoutView } from "./useActiveWorkout";

/**
 * The Progression suggestions (#71, ADR-0017) for each exercise of the active
 * workout, by workout exercise id, from the last finished workout's sets that
 * `usePreviousSets` loaded. Recomputed when today's sets, history or the
 * weight unit change; empty while history loads.
 */
export function useProgressionSuggestions(
	view: ActiveWorkoutView,
	previous: ReadonlyMap<string, WorkoutSet[]> | undefined,
	unit: WeightUnit,
): ReadonlyMap<string, ExerciseSuggestion[]> {
	return useMemo(() => {
		const suggestions = new Map<string, ExerciseSuggestion[]>();
		if (!previous) return suggestions;
		for (const { workoutExercise, sets } of view.detail.exercises) {
			const exercise = view.exercises.get(workoutExercise.exerciseId);
			suggestions.set(
				workoutExercise.id,
				suggestForExercise({
					sets,
					previous: previous.get(workoutExercise.exerciseId) ?? [],
					measure: resolveMeasure(exercise),
					exercise: exercise ?? { name: "" },
					unit,
				}),
			);
		}
		return suggestions;
	}, [view, previous, unit]);
}
