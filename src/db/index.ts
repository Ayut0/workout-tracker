import Dexie, { type EntityTable } from "dexie";
import {
	type Exercise,
	type RestTimer,
	type Settings,
	type Template,
	TIMER_STATUS,
	type Workout,
	type WorkoutExercise,
	type WorkoutSet,
} from "./types";

export const DB_NAME = "workout-tracker";

/** Key of the one settings record. */
const SETTINGS_ID = "app";

type SettingsRecord = Settings & { id: typeof SETTINGS_ID };

export const DEFAULT_SETTINGS: Settings = { weightUnit: "kg", restSeconds: 90 };

export class WorkoutDB extends Dexie {
	restTimers!: EntityTable<RestTimer, "id">;
	exercises!: EntityTable<Exercise, "id">;
	workouts!: EntityTable<Workout, "id">;
	workoutExercises!: EntityTable<WorkoutExercise, "id">;
	sets!: EntityTable<WorkoutSet, "id">;
	templates!: EntityTable<Template, "id">;
	settings!: EntityTable<SettingsRecord, "id">;

	constructor(name = DB_NAME) {
		super(name);
		// Only indexed fields are listed; other fields are stored as-is.
		// A schema change means a new this.version(n) block, never editing this one:
		// phones that already ran version 1 upgrade from it.
		this.version(1).stores({
			restTimers: "id, scheduledAt, status",
		});
		// Phase-2 training records (ADR-0002). Only adds stores, so it needs no
		// upgrade step; Dexie keeps the version-1 stores as they are.
		this.version(2).stores({
			exercises: "id, &nameKey",
			workouts: "id, startedAt",
			workoutExercises: "id, workoutId, exerciseId",
			sets: "id, workoutExerciseId",
			templates: "id",
			settings: "id",
		});
	}
}

export const db = new WorkoutDB();

/** Returns the most recent pending timer, the one a push just arrived for. */
export async function findLatestPendingTimer(
	database: WorkoutDB = db,
): Promise<RestTimer | undefined> {
	return database.restTimers
		.where("status")
		.equals(TIMER_STATUS.pending)
		.reverse()
		.sortBy("scheduledAt")
		.then((timers) => timers[0]);
}

/** Marks the latest pending timer as received now; returns it, if any. */
export async function markTimerReceived(
	receivedAt: number,
	database: WorkoutDB = db,
): Promise<RestTimer | undefined> {
	const timer = await findLatestPendingTimer(database);
	if (!timer) return undefined;
	await database.restTimers.update(timer.id, {
		status: TIMER_STATUS.received,
		receivedAt,
	});
	return { ...timer, status: TIMER_STATUS.received, receivedAt };
}

/**
 * The form of an exercise name used to match names: lower case, trimmed,
 * runs of whitespace collapsed. Stored as Exercise.nameKey.
 */
export function normalizeExerciseName(name: string): string {
	return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Exercises shown in the library: not archived, sorted by name ignoring case. */
export async function listLibraryExercises(
	database: WorkoutDB = db,
): Promise<Exercise[]> {
	return database.exercises
		.orderBy("nameKey")
		.filter((exercise) => exercise.archivedAt === undefined)
		.toArray();
}

/**
 * Removes an exercise from the library. One that a workout or template refers
 * to is archived (kept, hidden) so history still resolves; any other is deleted.
 */
export async function removeExercise(
	id: string,
	at: number,
	database: WorkoutDB = db,
): Promise<"deleted" | "archived"> {
	return database.transaction(
		"rw",
		[database.exercises, database.workoutExercises, database.templates],
		async () => {
			const inWorkout =
				(await database.workoutExercises
					.where("exerciseId")
					.equals(id)
					.count()) > 0;
			const inTemplate =
				(await database.templates
					.filter((t) => t.exercises.some((e) => e.exerciseId === id))
					.count()) > 0;
			if (inWorkout || inTemplate) {
				await database.exercises.update(id, { archivedAt: at });
				return "archived";
			}
			await database.exercises.delete(id);
			return "deleted";
		},
	);
}

/** A workout exercise with its sets, in set order. */
export interface WorkoutExerciseDetail {
	workoutExercise: WorkoutExercise;
	sets: WorkoutSet[];
}

/** A workout with its exercises and sets, each in order. */
export interface WorkoutDetail {
	workout: Workout;
	exercises: WorkoutExerciseDetail[];
}

/** Loads a workout with its exercises and sets in order; undefined if absent. */
export async function findWorkoutDetail(
	id: string,
	database: WorkoutDB = db,
): Promise<WorkoutDetail | undefined> {
	return database.transaction(
		"r",
		[database.workouts, database.workoutExercises, database.sets],
		async () => {
			const workout = await database.workouts.get(id);
			if (!workout) return undefined;
			const workoutExercises = await database.workoutExercises
				.where("workoutId")
				.equals(id)
				.sortBy("order");
			return {
				workout,
				exercises: await attachSets(workoutExercises, database),
			};
		},
	);
}

/** One appearance of an exercise in a workout, with its sets in order. */
export interface ExerciseHistoryEntry {
	workout: Workout;
	sets: WorkoutSet[];
}

/**
 * Every time an exercise was performed, oldest workout first, with its sets
 * in order. The input for progress metrics.
 */
export async function listExerciseHistory(
	exerciseId: string,
	database: WorkoutDB = db,
): Promise<ExerciseHistoryEntry[]> {
	return database.transaction(
		"r",
		[database.workouts, database.workoutExercises, database.sets],
		async () => {
			const workoutExercises = await database.workoutExercises
				.where("exerciseId")
				.equals(exerciseId)
				.toArray();
			const workouts = await database.workouts.bulkGet(
				workoutExercises.map((we) => we.workoutId),
			);
			const details = await attachSets(workoutExercises, database);
			const entries: ExerciseHistoryEntry[] = [];
			details.forEach((detail, i) => {
				const workout = workouts[i];
				if (workout) entries.push({ workout, sets: detail.sets });
			});
			return entries.sort((a, b) => a.workout.startedAt - b.workout.startedAt);
		},
	);
}

/** The workout in progress: the latest started one, if it has not ended. */
export async function findActiveWorkout(
	database: WorkoutDB = db,
): Promise<Workout | undefined> {
	const latest = await database.workouts.orderBy("startedAt").last();
	return latest?.endedAt === undefined ? latest : undefined;
}

/** The user's settings, with defaults for anything never saved. */
export async function findSettings(
	database: WorkoutDB = db,
): Promise<Settings> {
	const record = await database.settings.get(SETTINGS_ID);
	if (!record) return DEFAULT_SETTINGS;
	const { id: _id, ...settings } = record;
	return { ...DEFAULT_SETTINGS, ...settings };
}

/** Saves the given settings, keeping the others as they are. */
export async function saveSettings(
	changes: Partial<Settings>,
	database: WorkoutDB = db,
): Promise<void> {
	await database.transaction("rw", database.settings, async () => {
		const current = await findSettings(database);
		await database.settings.put({ ...current, ...changes, id: SETTINGS_ID });
	});
}

/** Pairs each workout exercise with its sets, sorted by set order. */
async function attachSets(
	workoutExercises: WorkoutExercise[],
	database: WorkoutDB,
): Promise<WorkoutExerciseDetail[]> {
	const sets = await database.sets
		.where("workoutExerciseId")
		.anyOf(workoutExercises.map((we) => we.id))
		.toArray();
	return workoutExercises.map((workoutExercise) => ({
		workoutExercise,
		sets: sets
			.filter((set) => set.workoutExerciseId === workoutExercise.id)
			.sort((a, b) => a.order - b.order),
	}));
}
