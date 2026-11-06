import {
	BACKUP_FORMAT,
	BACKUP_FORMAT_VERSION,
	BACKUP_SCHEMA_VERSION,
	type Backup,
	type BackupData,
	type BackupStore,
} from "./backup";
import { SETTINGS_ID, type SettingsRecord } from "./index";
import type {
	Exercise,
	Template,
	TemplateExercise,
	TemplateSet,
	Workout,
	WorkoutExercise,
	WorkoutSet,
} from "./types";

/**
 * Reading a backup file (ADR-0011): checks the envelope and versions,
 * migrates data written at an older schema version, and checks every record's
 * shape. Pure: writes nothing.
 */

export type BackupParseResult =
	| {
			ok: true;
			backup: Backup;
			/** The schema version the file was written at, when it was older. */
			migratedFrom?: number;
	  }
	| { ok: false; reason: string };

/** Returns what is wrong with a value, or undefined when it is fine. */
type Check = (value: unknown) => string | undefined;

/** One check per field, so the compiler insists every field is covered. */
type Spec<T> = { readonly [K in keyof T]-?: Check };

type RawData = Record<string, unknown>;

/** Turns data written at `version` into data at `version + 1`. */
type Migration = (data: RawData) => RawData;

/**
 * Keyed by the version migrated from. Version 1 had only restTimers, which
 * backups do not carry, so a version-1 backup holds no training records.
 */
const MIGRATIONS: Partial<Record<number, Migration>> = {
	1: () => ({
		exercises: [],
		workouts: [],
		workoutExercises: [],
		sets: [],
		templates: [],
		settings: [],
	}),
};

const STORE_LABELS: Record<BackupStore, string> = {
	exercises: "Exercise",
	workouts: "Workout",
	workoutExercises: "Workout exercise",
	sets: "Set",
	templates: "Template",
	settings: "Settings",
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const id: Check = (value) =>
	typeof value === "string" && value !== "" ? undefined : "must be an id";

const text: Check = (value) =>
	typeof value === "string" ? undefined : "must be text";

const finite: Check = (value) =>
	typeof value === "number" && Number.isFinite(value)
		? undefined
		: "must be a number";

const integer: Check = (value) =>
	Number.isInteger(value) ? undefined : "must be a whole number";

function optional(check: Check): Check {
	return (value) => (value === undefined ? undefined : check(value));
}

function oneOf(...allowed: unknown[]): Check {
	return (value) =>
		allowed.includes(value)
			? undefined
			: `must be ${allowed.map((a) => JSON.stringify(a)).join(" or ")}`;
}

/** The first problem with an object's fields, as "field problem". */
function findProblem<T>(value: unknown, spec: Spec<T>): string | undefined {
	if (!isObject(value)) return "must be an object";
	for (const [field, check] of Object.entries<Check>(spec)) {
		const problem = check(value[field]);
		if (problem !== undefined) return `${field} ${problem}`;
	}
	return undefined;
}

function conforms<T>(value: unknown, spec: Spec<T>): value is T {
	return findProblem(value, spec) === undefined;
}

function listOf<T>(spec: Spec<T>): Check {
	return (value) => {
		if (!Array.isArray(value)) return "must be a list";
		for (const [i, item] of value.entries()) {
			const problem = findProblem(item, spec);
			if (problem !== undefined) return `item ${i + 1}: ${problem}`;
		}
		return undefined;
	};
}

const EXERCISE: Spec<Exercise> = {
	id,
	name: text,
	nameKey: text,
	archivedAt: optional(finite),
	restSeconds: optional(finite),
};

const WORKOUT: Spec<Workout> = {
	id,
	name: text,
	startedAt: finite,
	endedAt: optional(finite),
	notes: optional(text),
};

const WORKOUT_EXERCISE: Spec<WorkoutExercise> = {
	id,
	workoutId: id,
	exerciseId: id,
	order: integer,
};

const SET: Spec<WorkoutSet> = {
	id,
	workoutExerciseId: id,
	order: integer,
	weightKg: optional(finite),
	reps: optional(finite),
	distanceM: optional(finite),
	seconds: optional(finite),
	rpe: optional(finite),
	notes: optional(text),
	completedAt: optional(finite),
};

const TEMPLATE_SET: Spec<TemplateSet> = {
	weightKg: optional(finite),
	reps: optional(finite),
};

const TEMPLATE_EXERCISE: Spec<TemplateExercise> = {
	exerciseId: id,
	sets: listOf(TEMPLATE_SET),
};

const TEMPLATE: Spec<Template> = {
	id,
	name: text,
	exercises: listOf(TEMPLATE_EXERCISE),
};

const SETTINGS: Spec<SettingsRecord> = {
	id: oneOf(SETTINGS_ID),
	weightUnit: oneOf("kg", "lb"),
	restSeconds: finite,
	lastBackupAt: optional(finite),
};

/** Reads one store's records, or says which record is wrong and how. */
function readRows<T extends { id: string }>(
	data: RawData,
	store: BackupStore,
	spec: Spec<T>,
): T[] | string {
	const rows = data[store];
	const label = STORE_LABELS[store];
	if (!Array.isArray(rows)) return `The backup has no list of "${store}".`;
	const read: T[] = [];
	const ids = new Set<string>();
	for (const [i, row] of rows.entries()) {
		if (!conforms(row, spec)) {
			return `${label} record ${i + 1}: ${findProblem(row, spec)}.`;
		}
		if (ids.has(row.id)) {
			return `${label} record ${i + 1}: id "${row.id}" appears twice.`;
		}
		ids.add(row.id);
		read.push(row);
	}
	return read;
}

/** Checks the records of every store; the first problem found wins. */
function readData(data: RawData): BackupData | string {
	const exercises = readRows(data, "exercises", EXERCISE);
	if (typeof exercises === "string") return exercises;
	const workouts = readRows(data, "workouts", WORKOUT);
	if (typeof workouts === "string") return workouts;
	const workoutExercises = readRows(data, "workoutExercises", WORKOUT_EXERCISE);
	if (typeof workoutExercises === "string") return workoutExercises;
	const sets = readRows(data, "sets", SET);
	if (typeof sets === "string") return sets;
	const templates = readRows(data, "templates", TEMPLATE);
	if (typeof templates === "string") return templates;
	const settings = readRows(data, "settings", SETTINGS);
	if (typeof settings === "string") return settings;

	// Exercise names are unique (the &nameKey index); a clash would fail the write.
	const nameKeys = new Set<string>();
	for (const exercise of exercises) {
		if (nameKeys.has(exercise.nameKey)) {
			return `Two exercises have the same name ("${exercise.name}").`;
		}
		nameKeys.add(exercise.nameKey);
	}
	return { exercises, workouts, workoutExercises, sets, templates, settings };
}

/** Brings data written at `from` up to BACKUP_SCHEMA_VERSION, or says why not. */
function migrate(data: RawData, from: number): RawData | string {
	let migrated = data;
	for (let version = from; version < BACKUP_SCHEMA_VERSION; version++) {
		const step = MIGRATIONS[version];
		if (!step) {
			return `This backup's data version (${from}) is too old to restore.`;
		}
		migrated = step(migrated);
	}
	return migrated;
}

/** Parses and checks a backup file's text. */
export function parseBackup(fileText: string): BackupParseResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(fileText);
	} catch {
		return {
			ok: false,
			reason: "This file is not a workout-tracker backup (it is not JSON).",
		};
	}
	if (!isObject(parsed) || parsed.format !== BACKUP_FORMAT) {
		return { ok: false, reason: "This file is not a workout-tracker backup." };
	}
	const { formatVersion, schemaVersion, exportedAt, data } = parsed;
	if (
		typeof formatVersion !== "number" ||
		typeof schemaVersion !== "number" ||
		!Number.isInteger(formatVersion) ||
		!Number.isInteger(schemaVersion)
	) {
		return {
			ok: false,
			reason: "This backup does not say which version wrote it.",
		};
	}
	if (formatVersion > BACKUP_FORMAT_VERSION) {
		return {
			ok: false,
			reason: `This backup was made by a newer version of the app (file format ${formatVersion}; this app reads ${BACKUP_FORMAT_VERSION}). Update the app, then restore it.`,
		};
	}
	if (schemaVersion > BACKUP_SCHEMA_VERSION) {
		return {
			ok: false,
			reason: `This backup was made by a newer version of the app (data version ${schemaVersion}; this app reads up to ${BACKUP_SCHEMA_VERSION}). Update the app, then restore it.`,
		};
	}
	if (formatVersion < 1 || schemaVersion < 1) {
		return { ok: false, reason: "This backup's version is not valid." };
	}
	if (typeof exportedAt !== "number" || !Number.isFinite(exportedAt)) {
		return { ok: false, reason: "This backup does not say when it was made." };
	}
	if (!isObject(data)) {
		return { ok: false, reason: "This backup holds no data." };
	}
	const migrated = migrate(data, schemaVersion);
	if (typeof migrated === "string") return { ok: false, reason: migrated };
	const read = readData(migrated);
	if (typeof read === "string") return { ok: false, reason: read };
	return {
		ok: true,
		backup: {
			format: BACKUP_FORMAT,
			formatVersion: BACKUP_FORMAT_VERSION,
			schemaVersion: BACKUP_SCHEMA_VERSION,
			exportedAt,
			data: read,
		},
		...(schemaVersion < BACKUP_SCHEMA_VERSION
			? { migratedFrom: schemaVersion }
			: {}),
	};
}
