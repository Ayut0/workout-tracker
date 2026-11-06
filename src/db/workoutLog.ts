import {
	db,
	findActiveWorkout,
	findWorkoutDetail,
	type WorkoutDB,
	type WorkoutDetail,
	type WorkoutExerciseDetail,
} from "./index";
import type {
	Exercise,
	TemplateExercise,
	Workout,
	WorkoutExercise,
	WorkoutSet,
} from "./types";

/**
 * Writes that log a workout (ADR-0007). Every edit is its own transaction and
 * lands in IndexedDB at once, so a killed app loses nothing; the screen reads
 * the result back live. None of these care whether the workout is active, so
 * editing a finished workout from History (#30) reuses them; only
 * startWorkout and finishWorkout deal with the active workout.
 *
 * The service worker's build includes all of src/db, so the small pure
 * helpers these writes need live here rather than in src/lib.
 */

/** An exercise to start a workout with, and its planned sets (a template's shape). */
export type PlannedExercise = TemplateExercise;

export interface StartWorkoutInput {
	name: string;
	startedAt: number;
	/** Exercises to start with, in order, e.g. from a template (#31). */
	exercises?: PlannedExercise[] | undefined;
}

/**
 * Starting while another workout is active does not start a second one: the
 * result carries the active workout so the caller can resume it.
 */
export type StartWorkoutResult =
	| { ok: true; workout: Workout }
	| { ok: false; reason: "active"; active: Workout };

/** Starts a workout, with optional planned exercises and sets. */
export async function startWorkout(
	input: StartWorkoutInput,
	database: WorkoutDB = db,
): Promise<StartWorkoutResult> {
	return database.transaction(
		"rw",
		[database.workouts, database.workoutExercises, database.sets],
		async () => {
			const active = await findActiveWorkout(database);
			if (active) return { ok: false, reason: "active", active };
			const workout: Workout = {
				id: crypto.randomUUID(),
				name: input.name,
				startedAt: input.startedAt,
			};
			await database.workouts.add(workout);
			const planned = input.exercises ?? [];
			for (const [order, exercise] of planned.entries()) {
				await insertWorkoutExercise(
					workout.id,
					exercise.exerciseId,
					order,
					exercise.sets,
					database,
				);
			}
			return { ok: true, workout };
		},
	);
}

/** Changes a workout's name and notes. A blank name is ignored; blank notes are cleared. */
export async function updateWorkout(
	workoutId: string,
	changes: { name?: string; notes?: string },
	database: WorkoutDB = db,
): Promise<boolean> {
	const updated = await database.workouts.update(workoutId, (workout) => {
		const name = changes.name?.trim();
		if (name) workout.name = name;
		if (changes.notes !== undefined) {
			if (changes.notes.trim() === "") delete workout.notes;
			else workout.notes = changes.notes;
		}
	});
	return updated > 0;
}

/**
 * Ends the active workout, keeping it as history. Returns undefined when the
 * workout does not exist or has already ended.
 */
export async function finishWorkout(
	workoutId: string,
	endedAt: number,
	database: WorkoutDB = db,
): Promise<Workout | undefined> {
	return database.transaction("rw", database.workouts, async () => {
		const workout = await database.workouts.get(workoutId);
		if (!workout || workout.endedAt !== undefined) return undefined;
		const finished: Workout = { ...workout, endedAt };
		await database.workouts.put(finished);
		return finished;
	});
}

/**
 * Deletes a workout with its exercises and sets, in one transaction so
 * nothing is left half-deleted. Discarding the active workout uses it, and so
 * can deleting one from History (#30). Destructive: confirm first.
 */
export async function deleteWorkout(
	workoutId: string,
	database: WorkoutDB = db,
): Promise<boolean> {
	return database.transaction(
		"rw",
		[database.workouts, database.workoutExercises, database.sets],
		async () => {
			const workout = await database.workouts.get(workoutId);
			if (!workout) return false;
			const ids = await database.workoutExercises
				.where("workoutId")
				.equals(workoutId)
				.primaryKeys();
			await database.sets.where("workoutExerciseId").anyOf(ids).delete();
			await database.workoutExercises.bulkDelete(ids);
			await database.workouts.delete(workoutId);
			return true;
		},
	);
}

/**
 * Adds an exercise at the end of a workout with one empty set. Returns
 * undefined when the workout does not exist.
 */
export async function addWorkoutExercise(
	workoutId: string,
	exerciseId: string,
	database: WorkoutDB = db,
): Promise<WorkoutExerciseDetail | undefined> {
	return database.transaction(
		"rw",
		[database.workouts, database.workoutExercises, database.sets],
		async () => {
			if (!(await database.workouts.get(workoutId))) return undefined;
			const order = await database.workoutExercises
				.where("workoutId")
				.equals(workoutId)
				.count();
			return insertWorkoutExercise(
				workoutId,
				exerciseId,
				order,
				[{}],
				database,
			);
		},
	);
}

/** Removes an exercise and its sets from a workout; the rest close up. */
export async function removeWorkoutExercise(
	workoutExerciseId: string,
	database: WorkoutDB = db,
): Promise<boolean> {
	return database.transaction(
		"rw",
		[database.workoutExercises, database.sets],
		async () => {
			const removed = await database.workoutExercises.get(workoutExerciseId);
			if (!removed) return false;
			await database.sets
				.where("workoutExerciseId")
				.equals(workoutExerciseId)
				.delete();
			await database.workoutExercises.delete(workoutExerciseId);
			const rest = await listWorkoutExercises(removed.workoutId, database);
			await database.workoutExercises.bulkPut(renumber(rest));
			return true;
		},
	);
}

/**
 * Moves an exercise to position `toIndex` within its workout (clamped to the
 * ends); the others shift to make room.
 */
export async function moveWorkoutExercise(
	workoutExerciseId: string,
	toIndex: number,
	database: WorkoutDB = db,
): Promise<boolean> {
	return database.transaction("rw", database.workoutExercises, async () => {
		const moving = await database.workoutExercises.get(workoutExerciseId);
		if (!moving) return false;
		const siblings = await listWorkoutExercises(moving.workoutId, database);
		const from = siblings.findIndex((we) => we.id === workoutExerciseId);
		await database.workoutExercises.bulkPut(
			renumber(moveItem(siblings, from, toIndex)),
		);
		return true;
	});
}

/**
 * Adds a set at the end of an exercise, starting with the weight and reps of
 * the set before it. Returns undefined when the exercise is not in a workout.
 */
export async function addSet(
	workoutExerciseId: string,
	database: WorkoutDB = db,
): Promise<WorkoutSet | undefined> {
	return database.transaction(
		"rw",
		[database.workoutExercises, database.sets],
		async () => {
			if (!(await database.workoutExercises.get(workoutExerciseId))) {
				return undefined;
			}
			const sets = await listSets(workoutExerciseId, database);
			const set: WorkoutSet = {
				id: crypto.randomUUID(),
				workoutExerciseId,
				order: sets.length,
				...planNextSet(sets.at(-1)),
			};
			await database.sets.add(set);
			return set;
		},
	);
}

/** Removes a set; the sets after it close up. */
export async function removeSet(
	setId: string,
	database: WorkoutDB = db,
): Promise<boolean> {
	return database.transaction("rw", database.sets, async () => {
		const removed = await database.sets.get(setId);
		if (!removed) return false;
		await database.sets.delete(setId);
		const rest = await listSets(removed.workoutExerciseId, database);
		await database.sets.bulkPut(renumber(rest));
		return true;
	});
}

/** The set fields a user edits; `undefined` clears a field. */
export type SetChanges = {
	[K in "weightKg" | "reps" | "distanceM" | "seconds" | "rpe" | "notes"]?:
		| WorkoutSet[K]
		| undefined;
};

/** Changes a set's measurements. Keys present with `undefined` are cleared. */
export async function updateSet(
	setId: string,
	changes: SetChanges,
	database: WorkoutDB = db,
): Promise<boolean> {
	const updated = await database.sets.update(setId, (set) => {
		for (const [key, value] of Object.entries(changes)) {
			if (!isSetChangeKey(key)) continue;
			if (value === undefined) delete set[key];
			else Object.assign(set, { [key]: value });
		}
	});
	return updated > 0;
}

const SET_CHANGE_KEYS = [
	"weightKg",
	"reps",
	"distanceM",
	"seconds",
	"rpe",
	"notes",
] as const satisfies readonly (keyof SetChanges)[];

function isSetChangeKey(key: string): key is keyof SetChanges {
	return SET_CHANGE_KEYS.some((k) => k === key);
}

/**
 * A set just marked done, with the exercise it belongs to: what the rest
 * timer (#29) needs to pick the rest (the exercise's own, else the default).
 */
export interface CompletedSet {
	set: WorkoutSet;
	workoutExercise: WorkoutExercise;
	/** Undefined only if the exercise was deleted from the library. */
	exercise: Exercise | undefined;
}

/** Marks a set done at `at`. Returns undefined when the set does not exist. */
export async function completeSet(
	setId: string,
	at: number,
	database: WorkoutDB = db,
): Promise<CompletedSet | undefined> {
	return database.transaction(
		"rw",
		[database.sets, database.workoutExercises, database.exercises],
		async () => {
			const current = await database.sets.get(setId);
			if (!current) return undefined;
			const workoutExercise = await database.workoutExercises.get(
				current.workoutExerciseId,
			);
			if (!workoutExercise) return undefined;
			const set: WorkoutSet = { ...current, completedAt: at };
			await database.sets.put(set);
			const exercise = await database.exercises.get(workoutExercise.exerciseId);
			return { set, workoutExercise, exercise };
		},
	);
}

/** Marks a set not done again. */
export async function uncompleteSet(
	setId: string,
	database: WorkoutDB = db,
): Promise<boolean> {
	const updated = await database.sets.update(setId, (set) => {
		delete set.completedAt;
	});
	return updated > 0;
}

/** The active workout with its exercises and sets in order, if one is in progress. */
export async function findActiveWorkoutDetail(
	database: WorkoutDB = db,
): Promise<WorkoutDetail | undefined> {
	return database.transaction(
		"r",
		[database.workouts, database.workoutExercises, database.sets],
		async () => {
			const active = await findActiveWorkout(database);
			return active && findWorkoutDetail(active.id, database);
		},
	);
}

async function insertWorkoutExercise(
	workoutId: string,
	exerciseId: string,
	order: number,
	sets: PlannedSet[],
	database: WorkoutDB,
): Promise<WorkoutExerciseDetail> {
	const workoutExercise: WorkoutExercise = {
		id: crypto.randomUUID(),
		workoutId,
		exerciseId,
		order,
	};
	await database.workoutExercises.add(workoutExercise);
	const records: WorkoutSet[] = sets.map((planned, setOrder) => ({
		id: crypto.randomUUID(),
		workoutExerciseId: workoutExercise.id,
		order: setOrder,
		...planNextSet(planned),
	}));
	await database.sets.bulkAdd(records);
	return { workoutExercise, sets: records };
}

function listWorkoutExercises(
	workoutId: string,
	database: WorkoutDB,
): Promise<WorkoutExercise[]> {
	return database.workoutExercises
		.where("workoutId")
		.equals(workoutId)
		.sortBy("order");
}

function listSets(
	workoutExerciseId: string,
	database: WorkoutDB,
): Promise<WorkoutSet[]> {
	return database.sets
		.where("workoutExerciseId")
		.equals(workoutExerciseId)
		.sortBy("order");
}

/**
 * Numbers the records 0, 1, 2… in the given order, keeping order dense;
 * returns only the records whose order changed, ready to write back.
 */
function renumber<T extends { order: number }>(records: readonly T[]): T[] {
	return records.flatMap((record, order) =>
		record.order === order ? [] : [{ ...record, order }],
	);
}

/** The measurements a new set starts with. */
export type PlannedSet = Pick<WorkoutSet, "weightKg" | "reps">;

/**
 * A new set added after `last` starts with its weight and reps (and nothing
 * else), so a straight set is one tap to confirm. The first set starts empty.
 * Also copies a planned set (from a template) into a new set record.
 */
export function planNextSet(last: PlannedSet | undefined): PlannedSet {
	const planned: PlannedSet = {};
	if (last?.weightKg !== undefined) planned.weightKg = last.weightKg;
	if (last?.reps !== undefined) planned.reps = last.reps;
	return planned;
}

/**
 * Moves the item at `from` to `to`, shifting the items between. `to` is
 * clamped to the ends; an unknown `from` changes nothing. Returns a new array.
 */
export function moveItem<T>(
	items: readonly T[],
	from: number,
	to: number,
): T[] {
	const result = [...items];
	if (from < 0 || from >= result.length) return result;
	const target = Math.min(Math.max(to, 0), result.length - 1);
	const moved = result.splice(from, 1);
	result.splice(target, 0, ...moved);
	return result;
}
