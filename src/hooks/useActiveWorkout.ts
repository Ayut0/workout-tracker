import { useLiveQuery } from "dexie-react-hooks";
import { db, type WorkoutDetail } from "../db";
import type { Exercise, Workout } from "../db/types";
import {
	addSet,
	addWorkoutExercise,
	type CompletedSet,
	completeSet,
	deleteWorkout,
	findActiveWorkoutDetail,
	finishWorkout,
	moveWorkoutExercise,
	type PlannedExercise,
	removeSet,
	removeWorkoutExercise,
	type SetChanges,
	type StartWorkoutResult,
	startWorkout,
	uncompleteSet,
	updateSet,
	updateWorkout,
} from "../db/workoutLog";
import { nameWorkoutFor } from "../lib/workoutLog";

/** The active workout as the Workout screen shows it. */
export interface ActiveWorkoutView {
	detail: WorkoutDetail;
	/** The library exercises the workout refers to, by id. */
	exercises: ReadonlyMap<string, Exercise>;
}

/**
 * The active workout, live: every write re-renders it, and reopening the app
 * resumes it. Undefined while loading, null when no workout is in progress.
 */
export function useActiveWorkout(): ActiveWorkoutView | null | undefined {
	return useLiveQuery(async () => {
		const detail = await findActiveWorkoutDetail();
		if (!detail) return null;
		const ids = detail.exercises.map((e) => e.workoutExercise.exerciseId);
		const exercises = new Map<string, Exercise>();
		for (const exercise of await db.exercises.bulkGet(ids)) {
			if (exercise) exercises.set(exercise.id, exercise);
		}
		return { detail, exercises };
	}, []);
}

/** The workout log's write actions, bound to the app database and clock. */
export const workoutLogActions = {
	/** Starts a workout named for the time of day; planned exercises are for templates (#31). */
	start: (exercises?: PlannedExercise[]): Promise<StartWorkoutResult> => {
		const startedAt = Date.now();
		return startWorkout({
			name: nameWorkoutFor(startedAt),
			startedAt,
			exercises,
		});
	},
	update: (workoutId: string, changes: { name?: string; notes?: string }) =>
		updateWorkout(workoutId, changes),
	finish: (workoutId: string): Promise<Workout | undefined> =>
		finishWorkout(workoutId, Date.now()),
	discard: (workoutId: string): Promise<boolean> => deleteWorkout(workoutId),
	addExercise: (workoutId: string, exerciseId: string) =>
		addWorkoutExercise(workoutId, exerciseId),
	removeExercise: (workoutExerciseId: string) =>
		removeWorkoutExercise(workoutExerciseId),
	moveExercise: (workoutExerciseId: string, toIndex: number) =>
		moveWorkoutExercise(workoutExerciseId, toIndex),
	addSet: (workoutExerciseId: string) => addSet(workoutExerciseId),
	removeSet: (setId: string) => removeSet(setId),
	updateSet: (setId: string, changes: SetChanges) => updateSet(setId, changes),
	completeSet: (setId: string): Promise<CompletedSet | undefined> =>
		completeSet(setId, Date.now()),
	uncompleteSet: (setId: string) => uncompleteSet(setId),
};
