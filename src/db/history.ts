import { db, type WorkoutDB } from "./index";
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from "./types";

/**
 * Reading and editing finished workouts for History (#30, ADR-0009). The
 * list reads one page at a time along the `startedAt` index, so it stays fast
 * with years of imported workouts: only a page's workouts and their sets are
 * ever loaded. Edits to a workout's exercises and sets reuse the writes in
 * `workoutLog.ts` (ADR-0007); delete reuses `deleteWorkout`.
 */

/** Workouts per History page. */
export const HISTORY_PAGE_SIZE = 30;

/**
 * Where a History page ends: the last workout shown. The next page holds the
 * workouts that come after it, newest first. Workouts that start at the same
 * moment are told apart by id, so none is skipped or shown twice.
 */
export interface HistoryCursor {
	startedAt: number;
	id: string;
}

/** An exercise in a History entry, with its library exercise and its sets in order. */
export interface HistoryExercise {
	workoutExercise: WorkoutExercise;
	/** Undefined only if the exercise was deleted from the library. */
	exercise: Exercise | undefined;
	sets: WorkoutSet[];
}

/** A finished workout with its exercises in order: one row of History. */
export interface HistoryEntry {
	workout: Workout;
	exercises: HistoryExercise[];
}

export interface HistoryPage {
	entries: HistoryEntry[];
	/** Where the next page starts; undefined when this is the last page. */
	next: HistoryCursor | undefined;
}

/**
 * One page of finished workouts, newest first, starting after `after` (or at
 * the newest). The active workout is not history and is left out.
 */
export async function listWorkoutHistory(
	options: { after?: HistoryCursor | undefined; limit?: number } = {},
	database: WorkoutDB = db,
): Promise<HistoryPage> {
	const limit = options.limit ?? HISTORY_PAGE_SIZE;
	const { after } = options;
	return database.transaction(
		"r",
		[
			database.workouts,
			database.workoutExercises,
			database.sets,
			database.exercises,
		],
		async () => {
			const range =
				after === undefined
					? database.workouts.orderBy("startedAt")
					: database.workouts.where("startedAt").belowOrEqual(after.startedAt);
			// Reading one more than a page tells whether another page follows.
			const workouts = await range
				.reverse()
				.filter(
					(workout) =>
						workout.endedAt !== undefined && comesAfter(workout, after),
				)
				.limit(limit + 1)
				.toArray();
			const shown = workouts.slice(0, limit);
			const last = shown.at(-1);
			const next =
				workouts.length > limit && last
					? { startedAt: last.startedAt, id: last.id }
					: undefined;
			return { entries: await attachExercises(shown, database), next };
		},
	);
}

/**
 * Newest first, ties broken by id descending: the order IndexedDB walks the
 * `startedAt` index in reverse.
 */
function comesAfter(workout: Workout, after: HistoryCursor | undefined) {
	if (after === undefined) return true;
	if (workout.startedAt !== after.startedAt) {
		return workout.startedAt < after.startedAt;
	}
	return workout.id < after.id;
}

async function attachExercises(
	workouts: Workout[],
	database: WorkoutDB,
): Promise<HistoryEntry[]> {
	const workoutExercises = await database.workoutExercises
		.where("workoutId")
		.anyOf(workouts.map((workout) => workout.id))
		.toArray();
	const sets = await database.sets
		.where("workoutExerciseId")
		.anyOf(workoutExercises.map((we) => we.id))
		.toArray();
	const exerciseIds = [...new Set(workoutExercises.map((we) => we.exerciseId))];
	const library = new Map<string, Exercise>();
	for (const exercise of await database.exercises.bulkGet(exerciseIds)) {
		if (exercise) library.set(exercise.id, exercise);
	}
	const setsByExercise = groupBy(sets, (set) => set.workoutExerciseId);
	const exercisesByWorkout = groupBy(workoutExercises, (we) => we.workoutId);
	return workouts.map((workout) => ({
		workout,
		exercises: byOrder(exercisesByWorkout.get(workout.id) ?? []).map(
			(workoutExercise) => ({
				workoutExercise,
				exercise: library.get(workoutExercise.exerciseId),
				sets: byOrder(setsByExercise.get(workoutExercise.id) ?? []),
			}),
		),
	}));
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string) {
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const key = keyOf(item);
		const group = groups.get(key);
		if (group) group.push(item);
		else groups.set(key, [item]);
	}
	return groups;
}

function byOrder<T extends { order: number }>(records: T[]): T[] {
	return records.sort((a, b) => a.order - b.order);
}

/**
 * Moving a workout's start is refused when the new start is in the future, or
 * not before the active workout's start: the active workout is the latest
 * started one (ADR-0002), so a finished workout after it would hide it.
 */
export type RescheduleWorkoutResult =
	| { ok: true; workout: Workout }
	| { ok: false; reason: "not-found" | "future" | "after-active" };

/**
 * Moves a workout to start at `startedAt`. The end time and the sets' done
 * times move by the same amount, so the duration and the order of events
 * within the workout stay as they were. One transaction.
 */
export async function rescheduleWorkout(
	workoutId: string,
	startedAt: number,
	now: number,
	database: WorkoutDB = db,
): Promise<RescheduleWorkoutResult> {
	return database.transaction(
		"rw",
		[database.workouts, database.workoutExercises, database.sets],
		async () => {
			const current = await database.workouts.get(workoutId);
			if (!current) return { ok: false, reason: "not-found" };
			if (startedAt > now) return { ok: false, reason: "future" };
			const latest = await database.workouts.orderBy("startedAt").last();
			const active = latest?.endedAt === undefined ? latest : undefined;
			if (active && active.id !== workoutId && startedAt >= active.startedAt) {
				return { ok: false, reason: "after-active" };
			}
			const shift = startedAt - current.startedAt;
			const workout: Workout = { ...current, startedAt };
			if (current.endedAt !== undefined) {
				workout.endedAt = current.endedAt + shift;
			}
			await database.workouts.put(workout);
			const workoutExerciseIds = await database.workoutExercises
				.where("workoutId")
				.equals(workoutId)
				.primaryKeys();
			await database.sets
				.where("workoutExerciseId")
				.anyOf(workoutExerciseIds)
				.modify((set) => {
					if (set.completedAt !== undefined) set.completedAt += shift;
				});
			return { ok: true, workout };
		},
	);
}
