import {
	db,
	findSettings,
	SETTINGS_ID,
	type SettingsRecord,
	type WorkoutDB,
} from "./index";
import type {
	Exercise,
	Template,
	Workout,
	WorkoutExercise,
	WorkoutSet,
} from "./types";

/**
 * Backups (ADR-0011): every user-data store written to one JSON file, and
 * restored by replacing all of them in one transaction.
 */

/** The `format` every backup file carries, so other JSON is rejected. */
export const BACKUP_FORMAT = "workout-tracker-backup";

/** Version of the file's envelope (format, versions, data); bump on change. */
export const BACKUP_FORMAT_VERSION = 1;

/**
 * The Dexie schema version backups are written and restored at. A test keeps
 * it equal to WorkoutDB's version, so a schema bump needs a backup migration.
 */
export const BACKUP_SCHEMA_VERSION = 2;

/**
 * The stores a backup carries. restTimers is left out: it holds
 * notification-check diagnostics, not training records (ADR-0011).
 */
export const BACKUP_STORES = [
	"exercises",
	"workouts",
	"workoutExercises",
	"sets",
	"templates",
	"settings",
] as const;

export type BackupStore = (typeof BACKUP_STORES)[number];

/** Every record of each backed-up store. */
export interface BackupData {
	exercises: Exercise[];
	workouts: Workout[];
	workoutExercises: WorkoutExercise[];
	sets: WorkoutSet[];
	templates: Template[];
	settings: SettingsRecord[];
}

/** A backup file's contents. */
export interface Backup {
	format: typeof BACKUP_FORMAT;
	formatVersion: number;
	schemaVersion: number;
	/** When the backup was made (epoch ms). */
	exportedAt: number;
	data: BackupData;
}

/** How many records each backed-up store holds. */
export type BackupCounts = Record<BackupStore, number>;

function listTables(database: WorkoutDB) {
	return BACKUP_STORES.map((store) => database[store]);
}

/** Reads every backed-up store in one transaction, so the copy is consistent. */
export async function exportBackup(
	exportedAt: number,
	database: WorkoutDB = db,
): Promise<Backup> {
	const data = await database.transaction(
		"r",
		listTables(database),
		async () => ({
			exercises: await database.exercises.toArray(),
			workouts: await database.workouts.toArray(),
			workoutExercises: await database.workoutExercises.toArray(),
			sets: await database.sets.toArray(),
			templates: await database.templates.toArray(),
			settings: await database.settings.toArray(),
		}),
	);
	return {
		format: BACKUP_FORMAT,
		formatVersion: BACKUP_FORMAT_VERSION,
		schemaVersion: database.verno,
		exportedAt,
		data,
	};
}

/** How many records of each store a backup holds. */
export function countBackupRecords(data: BackupData): BackupCounts {
	return {
		exercises: data.exercises.length,
		workouts: data.workouts.length,
		workoutExercises: data.workoutExercises.length,
		sets: data.sets.length,
		templates: data.templates.length,
		settings: data.settings.length,
	};
}

/** The workout with no end time that started last, as findActiveWorkout picks it. */
function findActiveIn(workouts: Workout[]): Workout | undefined {
	const latest = workouts.reduce<Workout | undefined>(
		(last, w) =>
			last === undefined || w.startedAt > last.startedAt ? w : last,
		undefined,
	);
	return latest?.endedAt === undefined ? latest : undefined;
}

/** What a restore would change: the file's counts against the stored ones. */
export interface RestorePreview {
	incoming: BackupCounts;
	current: BackupCounts;
	/** The workout in progress here now, which the restore would replace. */
	currentActive?: Workout;
	/** The workout in progress in the backup, which becomes the active one. */
	incomingActive?: Workout;
}

/** Compares a backup with what is stored now. Writes nothing. */
export async function previewRestore(
	backup: Backup,
	database: WorkoutDB = db,
): Promise<RestorePreview> {
	const current = await exportBackup(Date.now(), database);
	const currentActive = findActiveIn(current.data.workouts);
	const incomingActive = findActiveIn(backup.data.workouts);
	return {
		incoming: countBackupRecords(backup.data),
		current: countBackupRecords(current.data),
		...(currentActive ? { currentActive } : {}),
		...(incomingActive ? { incomingActive } : {}),
	};
}

/**
 * Replaces every backed-up store with the backup's records, in ONE
 * read-write transaction: if any write fails, the transaction aborts and the
 * data stored before is left exactly as it was. restTimers is not touched.
 * The backup must already be validated (parseBackup).
 */
export async function restoreBackup(
	backup: Backup,
	database: WorkoutDB = db,
): Promise<void> {
	const { data } = backup;
	await database.transaction("rw", listTables(database), async () => {
		await Promise.all(listTables(database).map((table) => table.clear()));
		await database.exercises.bulkAdd(data.exercises);
		await database.workouts.bulkAdd(data.workouts);
		await database.workoutExercises.bulkAdd(data.workoutExercises);
		await database.sets.bulkAdd(data.sets);
		await database.templates.bulkAdd(data.templates);
		await database.settings.bulkAdd(data.settings);
	});
}

/**
 * Records that a backup made at `at` exists, unless a later one is already
 * recorded (a restored file can be older than the last backup).
 */
export async function recordLastBackup(
	at: number,
	database: WorkoutDB = db,
): Promise<void> {
	await database.transaction("rw", database.settings, async () => {
		const current = await findSettings(database);
		if ((current.lastBackupAt ?? Number.NEGATIVE_INFINITY) >= at) return;
		await database.settings.put({
			...current,
			lastBackupAt: at,
			id: SETTINGS_ID,
		});
	});
}
