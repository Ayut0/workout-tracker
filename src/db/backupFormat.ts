import {
	BACKUP_FORMAT,
	BACKUP_FORMAT_VERSION,
	BACKUP_SCHEMA_VERSION,
	type Backup,
	type BackupData,
	type BackupStore,
} from "./backup";
import { isLocalDay, MAX_BODY_WEIGHT_KG, MAX_WAIST_CM } from "./bodyLog";
import {
	EQUIPMENT,
	EXERCISE_CATEGORIES,
	MOVEMENT_PATTERNS,
	MUSCLE_GROUPS,
	SET_MEASURES,
} from "./constants";
import { SETTINGS_ID, type SettingsRecord } from "./index";
import {
	checkInstructionsUrl,
	formatCount,
	MAX_INSTRUCTIONS_LENGTH,
	tidyInstructions,
} from "./instructions";
import {
	type BodyEntry,
	type Exercise,
	MAX_PLANNED_REPS,
	MAX_PLANNED_RIR,
	type ProgramLink,
	type Template,
	type TemplateExercise,
	type TemplateSet,
	type Workout,
	type WorkoutExercise,
	type WorkoutSet,
	type WorkoutSource,
} from "./types";
import { tidyNotes } from "./workoutLog";

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

/** A check across fields, run once every field passed its own. */
type Rule = (value: Record<string, unknown>) => string | undefined;

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
	// Version 3 added the body log (ADR-0015); older backups have none.
	2: (data) => ({ ...data, bodyEntries: [] }),
};

const STORE_LABELS: Record<BackupStore, string> = {
	exercises: "Exercise",
	workouts: "Workout",
	workoutExercises: "Workout exercise",
	sets: "Set",
	templates: "Template",
	settings: "Settings",
	bodyEntries: "Body log entry",
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const checkId: Check = (value) =>
	typeof value === "string" && value !== "" ? undefined : "must be an id";

const checkText: Check = (value) =>
	typeof value === "string" ? undefined : "must be text";

const checkFinite: Check = (value) =>
	typeof value === "number" && Number.isFinite(value)
		? undefined
		: "must be a number";

const checkFlag: Check = (value) =>
	typeof value === "boolean" ? undefined : "must be true or false";

const checkInteger: Check = (value) =>
	Number.isInteger(value) ? undefined : "must be a whole number";

const boundedCount =
	(min: number, max: number): Check =>
	(value) =>
		Number.isInteger(value) && Number(value) >= min && Number(value) <= max
			? undefined
			: `must be a whole number, ${min} to ${max}`;

const checkPositive: Check = (value) =>
	Number.isInteger(value) && Number(value) >= 1
		? undefined
		: "must be a whole number, 1 or more";

function makeOptional(check: Check): Check {
	return (value) => (value === undefined ? undefined : check(value));
}

function buildOneOfCheck(...allowed: unknown[]): Check {
	return (value) =>
		allowed.includes(value)
			? undefined
			: `must be ${allowed.map((a) => JSON.stringify(a)).join(" or ")}`;
}

/** The first problem with an object's fields, as "field problem". */
function findProblem<T>(
	value: unknown,
	spec: Spec<T>,
	rule?: Rule,
): string | undefined {
	if (!isObject(value)) return "must be an object";
	for (const [field, check] of Object.entries<Check>(spec)) {
		const problem = check(value[field]);
		if (problem !== undefined) {
			return problem.startsWith(":")
				? `${field}${problem}`
				: `${field} ${problem}`;
		}
	}
	return rule?.(value);
}

function matchesSpec<T>(
	value: unknown,
	spec: Spec<T>,
	rule?: Rule,
): value is T {
	return findProblem(value, spec, rule) === undefined;
}

function listOf<T>(spec: Spec<T>, rule?: Rule): Check {
	return (value) => {
		if (!Array.isArray(value)) return "must be a list";
		for (const [i, item] of value.entries()) {
			const problem = findProblem(item, spec, rule);
			if (problem !== undefined) return `item ${i + 1}: ${problem}`;
		}
		return undefined;
	};
}

/** A list whose every item passes `check`. */
function listOfValues(check: Check): Check {
	return (value) => {
		if (!Array.isArray(value)) return "must be a list";
		for (const [i, item] of value.entries()) {
			const problem = check(item);
			if (problem !== undefined) return `item ${i + 1} ${problem}`;
		}
		return undefined;
	};
}

/**
 * An object nested in a record, checked field by field. Its problem starts
 * with ":" so findProblem reports it as "source: program: week must be…".
 */
function buildObjectCheck<T>(spec: Spec<T>): Check {
	return (value) => {
		const problem = findProblem(value, spec);
		return problem === undefined ? undefined : `: ${problem}`;
	};
}

/**
 * A muscle list as the app writes it (ADR-0016): known groups, none twice,
 * and never empty (an empty list is stored as no field).
 */
const knownMuscles = listOfValues(buildOneOfCheck(...MUSCLE_GROUPS));
const muscles = makeOptional((value) => {
	const problem = knownMuscles(value);
	if (problem !== undefined) return problem;
	if (!Array.isArray(value)) return "must be a list";
	const list: unknown[] = value;
	if (list.length === 0) return "must not be empty";
	const seen = new Set<unknown>();
	for (const muscle of list) {
		if (seen.has(muscle))
			return `lists ${JSON.stringify(muscle)} more than once`;
		seen.add(muscle);
	}
	return undefined;
});

/** Instructions text (ADR-0020): at most the form's cap once trimmed. */
const checkInstructionsText: Check = (value) => {
	if (typeof value !== "string") return "must be text";
	return value.trim().length > MAX_INSTRUCTIONS_LENGTH
		? `must be at most ${formatCount(MAX_INSTRUCTIONS_LENGTH)} characters`
		: undefined;
};

/**
 * An instructions link (ADR-0020): what the form accepts once trimmed. A
 * blank one passes here and is dropped by tidyExerciseInstructions.
 */
const checkInstructionsLink: Check = (value) => {
	if (typeof value !== "string") return "must be text";
	const url = value.trim();
	if (url === "") return undefined;
	const problem = checkInstructionsUrl(url);
	return problem === undefined
		? undefined
		: `is not a link the app can save: ${problem}`;
};

const EXERCISE: Spec<Exercise> = {
	id: checkId,
	name: checkText,
	nameKey: checkText,
	archivedAt: makeOptional(checkFinite),
	restSeconds: makeOptional(checkFinite),
	// Missing in backups made before measures (ADR-0012): weight and reps.
	measure: makeOptional(buildOneOfCheck(...SET_MEASURES)),
	// Missing in backups made before attributes (ADR-0016): none chosen.
	primaryMuscles: muscles,
	secondaryMuscles: muscles,
	movementPattern: makeOptional(buildOneOfCheck(...MOVEMENT_PATTERNS)),
	category: makeOptional(buildOneOfCheck(...EXERCISE_CATEGORIES)),
	equipment: makeOptional(buildOneOfCheck(...EQUIPMENT)),
	// Missing in backups made before instructions (ADR-0020): none written.
	instructions: makeOptional(checkInstructionsText),
	instructionsUrl: makeOptional(checkInstructionsLink),
};

/** Where a template sits in a program (ADR-0018); absent before #74. */
const PROGRAM_LINK: Spec<ProgramLink> = {
	programId: checkId,
	programName: checkText,
	block: checkPositive,
	week: checkPositive,
	day: makeOptional(checkText),
	deload: makeOptional(checkFlag),
};

const WORKOUT_SOURCE: Spec<WorkoutSource> = {
	templateId: checkId,
	templateName: checkText,
	program: makeOptional(buildObjectCheck(PROGRAM_LINK)),
};

const WORKOUT: Spec<Workout> = {
	id: checkId,
	name: checkText,
	startedAt: checkFinite,
	endedAt: makeOptional(checkFinite),
	notes: makeOptional(checkText),
	// The template it was started from (ADR-0018); absent before #74.
	source: makeOptional(buildObjectCheck(WORKOUT_SOURCE)),
};

const WORKOUT_EXERCISE: Spec<WorkoutExercise> = {
	id: checkId,
	workoutId: checkId,
	exerciseId: checkId,
	order: checkInteger,
	// Copied from a template exercise (ADR-0014); absent before #66.
	notes: makeOptional(checkText),
};

/**
 * A planned rep range (ADR-0014) has both ends or neither, and its bottom is
 * not above its top. Each end is already known to be 1 to MAX_PLANNED_REPS.
 */
const checkRepRange: Rule = ({ repMin, repMax }) => {
	if ((repMin === undefined) !== (repMax === undefined)) {
		return "repMin and repMax must be given together";
	}
	if (Number(repMin) > Number(repMax)) {
		return "repMin must not be more than repMax";
	}
	return undefined;
};

const repsBound = boundedCount(1, MAX_PLANNED_REPS);
const rirBound = boundedCount(0, MAX_PLANNED_RIR);

const SET: Spec<WorkoutSet> = {
	id: checkId,
	workoutExerciseId: checkId,
	order: checkInteger,
	weightKg: makeOptional(checkFinite),
	reps: makeOptional(checkFinite),
	distanceM: makeOptional(checkFinite),
	seconds: makeOptional(checkFinite),
	rpe: makeOptional(checkFinite),
	notes: makeOptional(checkText),
	// Missing in backups made before warm-ups (#65): a working set.
	warmup: makeOptional(checkFlag),
	completedAt: makeOptional(checkFinite),
	// Planned targets copied from a template (ADR-0014); absent before #69.
	repMin: makeOptional(repsBound),
	repMax: makeOptional(repsBound),
	targetRir: makeOptional(rirBound),
};

const TEMPLATE_SET: Spec<TemplateSet> = {
	weightKg: makeOptional(checkFinite),
	reps: makeOptional(checkFinite),
	seconds: makeOptional(checkFinite),
	distanceM: makeOptional(checkFinite),
	warmup: makeOptional(checkFlag),
	repMin: makeOptional(repsBound),
	repMax: makeOptional(repsBound),
	targetRir: makeOptional(rirBound),
};

const TEMPLATE_EXERCISE: Spec<TemplateExercise> = {
	exerciseId: checkId,
	sets: listOf(TEMPLATE_SET, checkRepRange),
	notes: makeOptional(checkText),
};

const TEMPLATE: Spec<Template> = {
	id: checkId,
	name: checkText,
	exercises: listOf(TEMPLATE_EXERCISE),
	// Set by a program import (ADR-0018); absent before #74.
	program: makeOptional(buildObjectCheck(PROGRAM_LINK)),
};

const SETTINGS: Spec<SettingsRecord> = {
	id: buildOneOfCheck(SETTINGS_ID),
	weightUnit: buildOneOfCheck("kg", "lb"),
	restSeconds: checkFinite,
	lastBackupAt: makeOptional(checkFinite),
};

const checkLocalDay: Check = (value) =>
	isLocalDay(value) ? undefined : "must be a day (YYYY-MM-DD)";

/** A number above zero and at most `max`, as the body log form requires. */
function buildPositiveUpToCheck(max: number): Check {
	return (value) =>
		typeof value === "number" &&
		Number.isFinite(value) &&
		value > 0 &&
		value <= max
			? undefined
			: `must be a number above 0 and at most ${max}`;
}

const BODY_ENTRY: Spec<BodyEntry> = {
	id: checkId,
	date: checkLocalDay,
	bodyWeightKg: makeOptional(buildPositiveUpToCheck(MAX_BODY_WEIGHT_KG)),
	waistCm: makeOptional(buildPositiveUpToCheck(MAX_WAIST_CM)),
};

/** Reads one store's records, or says which record is wrong and how. */
function readRows<T extends { id: string }>(
	data: RawData,
	store: BackupStore,
	spec: Spec<T>,
	rule?: Rule,
): T[] | string {
	const rows = data[store];
	const label = STORE_LABELS[store];
	if (!Array.isArray(rows)) return `The backup has no list of "${store}".`;
	const read: T[] = [];
	const ids = new Set<string>();
	for (const [i, row] of rows.entries()) {
		if (!matchesSpec(row, spec, rule)) {
			return `${label} record ${i + 1}: ${findProblem(row, spec, rule)}.`;
		}
		if (ids.has(row.id)) {
			return `${label} record ${i + 1}: id "${row.id}" appears twice.`;
		}
		ids.add(row.id);
		read.push(row);
	}
	return read;
}

/**
 * Keeps the "notes are never blank" invariant (ADR-0014) on restore: trims
 * the notes and drops them when nothing is left.
 */
function tidyRecordNotes<T extends { notes?: string }>(record: T): T {
	if (record.notes === undefined) return record;
	const tidy = tidyNotes(record.notes);
	const copy = { ...record };
	if (tidy === undefined) delete copy.notes;
	else Object.assign(copy, { notes: tidy });
	return copy;
}

/**
 * Keeps an exercise's instructions as the form stores them (ADR-0020):
 * trimmed, and no field at all when blank.
 */
function tidyExerciseInstructions(exercise: Exercise): Exercise {
	if (
		exercise.instructions === undefined &&
		exercise.instructionsUrl === undefined
	) {
		return exercise;
	}
	const copy = { ...exercise };
	delete copy.instructions;
	delete copy.instructionsUrl;
	const text = tidyInstructions(exercise.instructions ?? "");
	const url = tidyInstructions(exercise.instructionsUrl ?? "");
	if (text !== undefined) copy.instructions = text;
	if (url !== undefined) copy.instructionsUrl = url;
	return copy;
}

/** Checks the records of every store; the first problem found wins. */
function readData(data: RawData): BackupData | string {
	const exercises = readRows(data, "exercises", EXERCISE);
	if (typeof exercises === "string") return exercises;
	const workouts = readRows(data, "workouts", WORKOUT);
	if (typeof workouts === "string") return workouts;
	const workoutExercises = readRows(data, "workoutExercises", WORKOUT_EXERCISE);
	if (typeof workoutExercises === "string") return workoutExercises;
	const sets = readRows(data, "sets", SET, checkRepRange);
	if (typeof sets === "string") return sets;
	const templates = readRows(data, "templates", TEMPLATE);
	if (typeof templates === "string") return templates;
	const settings = readRows(data, "settings", SETTINGS);
	if (typeof settings === "string") return settings;
	const bodyEntries = readRows(data, "bodyEntries", BODY_ENTRY);
	if (typeof bodyEntries === "string") return bodyEntries;

	// Only `true` is stored (ADR-0012): `warmup: false` from a hand-edited or
	// foreign backup restores as a working set.
	const normalisedSets = sets.map(dropFalseWarmup);
	const normalisedTemplates = templates.map((template) => ({
		...template,
		exercises: template.exercises.map((exercise) => ({
			...exercise,
			sets: exercise.sets.map(dropFalseWarmup),
		})),
	}));

	// Exercise names are unique (the &nameKey index); a clash would fail the write.
	const nameKeys = new Set<string>();
	for (const [i, exercise] of exercises.entries()) {
		// A muscle is primary or secondary, never both (ADR-0016).
		const overlap = exercise.primaryMuscles?.find((muscle) =>
			exercise.secondaryMuscles?.includes(muscle),
		);
		if (overlap !== undefined) {
			return `Exercise record ${i + 1}: ${JSON.stringify(overlap)} is in both primaryMuscles and secondaryMuscles.`;
		}
		if (nameKeys.has(exercise.nameKey)) {
			return `Two exercises have the same name ("${exercise.name}").`;
		}
		nameKeys.add(exercise.nameKey);
	}
	// One body log entry per day (the &date index); a clash would fail the write.
	const days = new Set<string>();
	for (const [i, entry] of bodyEntries.entries()) {
		// An entry holds at least one measurement (ADR-0015).
		if (entry.bodyWeightKg === undefined && entry.waistCm === undefined) {
			return `${STORE_LABELS.bodyEntries} record ${i + 1}: needs at least one measurement (bodyWeightKg or waistCm).`;
		}
		if (days.has(entry.date)) {
			return `Two body log entries are for the same day (${entry.date}).`;
		}
		days.add(entry.date);
	}
	return {
		exercises: exercises.map(tidyExerciseInstructions),
		workouts,
		workoutExercises: workoutExercises.map(tidyRecordNotes),
		sets: normalisedSets,
		templates: normalisedTemplates.map((template) => ({
			...template,
			exercises: template.exercises.map(tidyRecordNotes),
		})),
		settings,
		bodyEntries,
	};
}

/** The record without a `warmup: false`; anything else is returned as it is. */
function dropFalseWarmup<T extends { warmup?: boolean }>(record: T): T {
	if (record.warmup !== false) return record;
	const copy = { ...record };
	delete copy.warmup;
	return copy;
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
