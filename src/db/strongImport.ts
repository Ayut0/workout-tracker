import {
	db,
	normalizeExerciseName,
	tidyExerciseName,
	type WorkoutDB,
} from "./index";
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from "./types";

/**
 * Storing a parsed Strong export (ADR-0008). Two steps: a pure plan that the
 * preview shows, and one transaction that writes it. The import only adds
 * records; it never changes or deletes one that is already stored.
 */

/** Measurements of a set to import; the import adds id, order and completedAt. */
export type ImportSet = Omit<
	WorkoutSet,
	"id" | "workoutExerciseId" | "order" | "completedAt"
>;

/**
 * A finished workout to import, shaped like the Strong parser's StrongWorkout
 * (src/lib/strongCsv.ts). Declared here, not imported, because src/db is also
 * compiled for the service worker, which does not include src/lib.
 */
export interface ImportWorkout {
	name: string;
	startedAt: number;
	endedAt: number;
	notes?: string;
	/** In order; the same exercise may appear more than once. */
	exercises: { name: string; sets: ImportSet[] }[];
}

/** A row of the file the parser could not use, shown in the preview. */
export interface ImportSkippedRow {
	line: number;
	reason: string;
}

/**
 * Identifies a workout across imports: its start time and its name, compared
 * ignoring case and spacing. A workout whose key is already stored is skipped,
 * so importing the same file again adds nothing.
 */
export function toWorkoutImportKey(startedAt: number, name: string): string {
	return `${startedAt}\n${normalizeExerciseName(name)}`;
}

/** What is already stored, as far as the import needs to know. */
export interface StoredImportKeys {
	/** Exercise.nameKey of every exercise, archived ones included. */
	exerciseNameKeys: ReadonlySet<string>;
	/** toWorkoutImportKey of the stored workouts the import might repeat. */
	workoutKeys: ReadonlySet<string>;
}

/** What an import would add, for the preview. */
export interface StrongImportPlan {
	/** Workouts not stored yet, in file order. */
	workouts: ImportWorkout[];
	/** Workouts already stored (same start and name); they are left alone. */
	duplicateCount: number;
	/** Sets in the workouts to add. */
	setCount: number;
	/** Start of the earliest workout to add; undefined when none is new. */
	firstStartedAt?: number;
	/** Start of the latest workout to add; undefined when none is new. */
	lastStartedAt?: number;
	/**
	 * Exercises to create, as first spelled in the file, in order of first
	 * appearance. Every other exercise matches one already stored.
	 */
	newExerciseNames: string[];
	/** Rows of the file the parser could not use. */
	skipped: ImportSkippedRow[];
}

/** Works out what importing the workouts would add. Pure. */
export function planStrongImport(
	workouts: ImportWorkout[],
	skipped: ImportSkippedRow[],
	stored: StoredImportKeys,
): StrongImportPlan {
	const toAdd = workouts.filter(
		(w) => !stored.workoutKeys.has(toWorkoutImportKey(w.startedAt, w.name)),
	);
	const newExercises = new Map<string, string>();
	let setCount = 0;
	let firstStartedAt: number | undefined;
	let lastStartedAt: number | undefined;
	for (const workout of toAdd) {
		firstStartedAt = Math.min(
			firstStartedAt ?? workout.startedAt,
			workout.startedAt,
		);
		lastStartedAt = Math.max(
			lastStartedAt ?? workout.startedAt,
			workout.startedAt,
		);
		for (const exercise of workout.exercises) {
			setCount += exercise.sets.length;
			const nameKey = normalizeExerciseName(exercise.name);
			if (!stored.exerciseNameKeys.has(nameKey) && !newExercises.has(nameKey)) {
				newExercises.set(nameKey, tidyExerciseName(exercise.name));
			}
		}
	}
	return {
		workouts: toAdd,
		duplicateCount: workouts.length - toAdd.length,
		setCount,
		...(firstStartedAt === undefined ? {} : { firstStartedAt }),
		...(lastStartedAt === undefined ? {} : { lastStartedAt }),
		newExerciseNames: [...newExercises.values()],
		skipped,
	};
}

/**
 * Reads what the import needs to know from the database. Only workouts that
 * start when an imported one does can be duplicates, so only those are read.
 */
async function readStoredImportKeys(
	workouts: ImportWorkout[],
	database: WorkoutDB,
): Promise<{ keys: StoredImportKeys; exercises: Exercise[] }> {
	const exercises = await database.exercises.toArray();
	const startTimes = [...new Set(workouts.map((w) => w.startedAt))];
	const candidates = await database.workouts
		.where("startedAt")
		.anyOf(startTimes)
		.toArray();
	return {
		exercises,
		keys: {
			exerciseNameKeys: new Set(exercises.map((e) => e.nameKey)),
			workoutKeys: new Set(
				candidates.map((w) => toWorkoutImportKey(w.startedAt, w.name)),
			),
		},
	};
}

/** The plan for importing the workouts into the database as it is now. */
export async function previewStrongImport(
	workouts: ImportWorkout[],
	skipped: ImportSkippedRow[],
	database: WorkoutDB = db,
): Promise<StrongImportPlan> {
	return database.transaction(
		"r",
		[database.exercises, database.workouts],
		async () => {
			const { keys } = await readStoredImportKeys(workouts, database);
			return planStrongImport(workouts, skipped, keys);
		},
	);
}

/** What an import added. */
export interface StrongImportResult {
	workoutsAdded: number;
	/** Workouts skipped because they were already stored. */
	duplicateCount: number;
	exercisesCreated: number;
	setsAdded: number;
}

/** The records for the workouts, ready to bulkAdd. */
interface ImportRecords {
	exercises: Exercise[];
	workouts: Workout[];
	workoutExercises: WorkoutExercise[];
	sets: WorkoutSet[];
}

function buildImportRecords(
	plan: StrongImportPlan,
	storedExercises: Exercise[],
): ImportRecords {
	const exerciseIds = new Map(storedExercises.map((e) => [e.nameKey, e.id]));
	const records: ImportRecords = {
		exercises: plan.newExerciseNames.map((name) => ({
			id: crypto.randomUUID(),
			name,
			nameKey: normalizeExerciseName(name),
		})),
		workouts: [],
		workoutExercises: [],
		sets: [],
	};
	for (const exercise of records.exercises) {
		exerciseIds.set(exercise.nameKey, exercise.id);
	}
	for (const strong of plan.workouts) {
		const workout: Workout = {
			id: crypto.randomUUID(),
			name: strong.name,
			startedAt: strong.startedAt,
			endedAt: strong.endedAt,
			...(strong.notes === undefined ? {} : { notes: strong.notes }),
		};
		records.workouts.push(workout);
		strong.exercises.forEach((strongExercise, exerciseOrder) => {
			const exerciseId = exerciseIds.get(
				normalizeExerciseName(strongExercise.name),
			);
			// The plan creates every exercise it does not find, so this holds.
			if (exerciseId === undefined) {
				throw new Error(`No exercise for "${strongExercise.name}"`);
			}
			const workoutExercise: WorkoutExercise = {
				id: crypto.randomUUID(),
				workoutId: workout.id,
				exerciseId,
				order: exerciseOrder,
			};
			records.workoutExercises.push(workoutExercise);
			strongExercise.sets.forEach((set, setOrder) => {
				// Strong only exports done sets; the export keeps no time per set.
				records.sets.push({
					...set,
					id: crypto.randomUUID(),
					workoutExerciseId: workoutExercise.id,
					order: setOrder,
					completedAt: strong.endedAt,
				});
			});
		});
	}
	return records;
}

/**
 * Stores the workouts that are not stored yet, in one transaction: either all
 * of them are added or, if anything fails, none. Duplicates are checked again
 * inside the transaction, so a plan that went stale since the preview cannot
 * add a workout twice. Existing records are never changed.
 */
export async function importStrongWorkouts(
	workouts: ImportWorkout[],
	database: WorkoutDB = db,
): Promise<StrongImportResult> {
	return database.transaction(
		"rw",
		[
			database.exercises,
			database.workouts,
			database.workoutExercises,
			database.sets,
		],
		async () => {
			const { keys, exercises } = await readStoredImportKeys(
				workouts,
				database,
			);
			const plan = planStrongImport(workouts, [], keys);
			const records = buildImportRecords(plan, exercises);
			await database.exercises.bulkAdd(records.exercises);
			await database.workouts.bulkAdd(records.workouts);
			await database.workoutExercises.bulkAdd(records.workoutExercises);
			await database.sets.bulkAdd(records.sets);
			return {
				workoutsAdded: records.workouts.length,
				duplicateCount: plan.duplicateCount,
				exercisesCreated: records.exercises.length,
				setsAdded: records.sets.length,
			};
		},
	);
}
