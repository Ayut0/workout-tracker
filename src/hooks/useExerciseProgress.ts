import { useLiveQuery } from "dexie-react-hooks";
import { listExerciseHistory, listExercisesWithHistory } from "../db";
import type { Exercise } from "../db/types";
import { type ExerciseProgress, summarizeProgress } from "../lib/progress";

/** Exercises the Progress tab can chart, live; undefined while loading. */
export function useExercisesWithHistory(): Exercise[] | undefined {
	return useLiveQuery(() => listExercisesWithHistory(), []);
}

/**
 * An exercise's progress points and personal records over finished workouts,
 * live; undefined while loading or when no exercise is chosen.
 */
export function useExerciseProgress(
	exerciseId: string | undefined,
): ExerciseProgress | undefined {
	const result = useLiveQuery(
		async () =>
			exerciseId === undefined
				? undefined
				: {
						exerciseId,
						progress: summarizeProgress(await listExerciseHistory(exerciseId)),
					},
		[exerciseId],
	);
	// useLiveQuery keeps the previous result until the new query resolves;
	// never show one exercise's progress under another's name.
	return result?.exerciseId === exerciseId ? result?.progress : undefined;
}
