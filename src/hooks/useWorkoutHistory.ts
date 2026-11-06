import { useLiveQuery } from "dexie-react-hooks";
import { db, findWorkoutDetail, type WorkoutDetail } from "../db";
import {
	type HistoryCursor,
	type HistoryPage,
	listWorkoutHistory,
	type RescheduleWorkoutResult,
	rescheduleWorkout,
} from "../db/history";
import type { Exercise } from "../db/types";
import { completeSet, deleteWorkout } from "../db/workoutLog";

/**
 * One page of History, newest first, starting after `after`; live, so an
 * edit or delete shows at once. Undefined while loading.
 */
export function useHistoryPage(
	after: HistoryCursor | undefined,
): HistoryPage | undefined {
	return useLiveQuery(
		() => listWorkoutHistory({ after }),
		[after?.startedAt, after?.id],
	);
}

/** A past workout as its detail screen shows it. */
export interface WorkoutDetailView {
	detail: WorkoutDetail;
	/** The library exercises the workout refers to, by id. */
	exercises: ReadonlyMap<string, Exercise>;
}

/**
 * A workout with its exercises and sets, live. Undefined while loading, null
 * when no workout has this id (e.g. it was just deleted).
 */
export function useWorkoutDetail(
	workoutId: string,
): WorkoutDetailView | null | undefined {
	const result = useLiveQuery(async () => {
		const detail = await findWorkoutDetail(workoutId);
		if (!detail) return { workoutId, view: null };
		const ids = detail.exercises.map((e) => e.workoutExercise.exerciseId);
		const exercises = new Map<string, Exercise>();
		for (const exercise of await db.exercises.bulkGet(ids)) {
			if (exercise) exercises.set(exercise.id, exercise);
		}
		return { workoutId, view: { detail, exercises } };
	}, [workoutId]);
	// useLiveQuery keeps the previous result until the new query resolves;
	// never show one workout's sets under another's address.
	return result?.workoutId === workoutId ? result.view : undefined;
}

/**
 * History's own writes, bound to the app database and clock. Editing a past
 * workout's exercises and sets uses `workoutLogActions` (ADR-0007).
 */
export const historyActions = {
	reschedule: (
		workoutId: string,
		startedAt: number,
	): Promise<RescheduleWorkoutResult> =>
		rescheduleWorkout(workoutId, startedAt, Date.now()),
	/** Marks a past workout's set done as of the workout's end, as the Strong import does. */
	completeSet: (setId: string, at: number) => completeSet(setId, at),
	delete: (workoutId: string): Promise<boolean> => deleteWorkout(workoutId),
};
