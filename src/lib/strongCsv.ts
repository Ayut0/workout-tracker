import type { WeightUnit } from "../db/types";

/**
 * Parser for the CSV that the Strong app exports. Pure: no DOM, no Dexie.
 *
 * It groups rows into workouts → exercises → sets, converts weight to kg and
 * distance to metres (ADR-0002), and reports every row it could not use
 * instead of failing. Exercise names are passed through as written; matching
 * them to the library (normalizeExerciseName) is the importer's job (#34).
 *
 * Strong only exports finished workouts and done sets, so every set here is a
 * complete set and every workout has an end time.
 */

export type DistanceUnit = "m" | "km" | "mi";

/** One set as exported. Strong writes 0 for an unused field; it is left out. */
export interface StrongSet {
	weightKg?: number;
	reps?: number;
	distanceM?: number;
	seconds?: number;
	rpe?: number;
	notes?: string;
}

/** A run of sets of one exercise; the same exercise may appear again later. */
export interface StrongExercise {
	/** The exercise name exactly as in the export. */
	name: string;
	/** In file order, which is the order they were done. */
	sets: StrongSet[];
}

export interface StrongWorkout {
	name: string;
	/** Epoch ms. Strong's Date column is local time on this device. */
	startedAt: number;
	/** startedAt plus the Duration column; startedAt if that is unreadable. */
	endedAt: number;
	notes?: string;
	exercises: StrongExercise[];
}

export interface SkippedRow {
	/** Line in the file where the row starts (the header is line 1). */
	line: number;
	reason: string;
}

export type UnitKind = "weight" | "distance";

export type ParseKind = "parsed" | "needsUnits" | "invalid";

export const PARSE_KIND = {
	parsed: "parsed",
	needsUnits: "needsUnits",
	invalid: "invalid",
} as const satisfies { [K in ParseKind]: K };

export type StrongParseResult =
	| {
			kind: typeof PARSE_KIND.parsed;
			/** In file order (Strong exports newest or oldest first). */
			workouts: StrongWorkout[];
			skipped: SkippedRow[];
			/** The unit the weights were read in, from the header or the option. */
			weightUnit?: WeightUnit;
	  }
	/** The header does not say a unit some rows need: ask, then parse again. */
	| { kind: typeof PARSE_KIND.needsUnits; missing: UnitKind[] }
	| { kind: typeof PARSE_KIND.invalid; reason: string };

export interface StrongParseOptions {
	/** Used when the export does not say its weight unit. */
	weightUnit?: WeightUnit;
	/** Used when the export does not say its distance unit. */
	distanceUnit?: DistanceUnit;
}

const KG_PER_LB = 0.45359237;
const METRES_PER: { [U in DistanceUnit]: number } = {
	m: 1,
	km: 1000,
	mi: 1609.344,
};
const MS_PER_SECOND = 1000;
const LAST_HOUR = 23;
const LAST_MINUTE = 59;
const SECONDS_PER: { [U in "h" | "m" | "s"]: number } = {
	h: 3600,
	m: 60,
	s: 1,
};

// ---------------------------------------------------------------- CSV

const BYTE_ORDER_MARK = 0xfeff;

export interface CsvRecord {
	/** Line where the record starts, from 1. */
	line: number;
	fields: string[];
}

/**
 * Splits CSV text into records (RFC 4180: quoted fields may hold the
 * delimiter, newlines and doubled quotes). Blank lines are dropped.
 */
export function parseCsvRecords(text: string, delimiter: string): CsvRecord[] {
	const records: CsvRecord[] = [];
	let fields: string[] = [];
	let field = "";
	let inQuotes = false;
	let line = 1;
	let recordLine = 1;
	const input = text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text;

	const endRecord = () => {
		fields.push(field);
		const isBlank = fields.length === 1 && fields[0] === "";
		if (!isBlank) records.push({ line: recordLine, fields });
		fields = [];
		field = "";
	};

	for (let i = 0; i < input.length; i++) {
		const char = input[i];
		if (inQuotes) {
			if (char === '"' && input[i + 1] === '"') {
				field += '"';
				i++;
			} else if (char === '"') {
				inQuotes = false;
			} else {
				if (char === "\n") line++;
				field += char;
			}
		} else if (char === '"') {
			inQuotes = true;
		} else if (char === delimiter) {
			fields.push(field);
			field = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && input[i + 1] === "\n") i++;
			endRecord();
			line++;
			recordLine = line;
		} else {
			field += char;
		}
	}
	endRecord();
	return records;
}

// ---------------------------------------------------------------- values

/** Reads Strong's "1h 5m", "45m" or "30s" as seconds. */
export function parseStrongDuration(text: string): number | undefined {
	const parts = text.trim().split(/\s+/);
	let seconds = 0;
	for (const part of parts) {
		const match = /^(\d+)([hms])$/.exec(part);
		const unit = match?.[2];
		if (!match || (unit !== "h" && unit !== "m" && unit !== "s")) {
			return undefined;
		}
		seconds += Number(match[1]) * SECONDS_PER[unit];
	}
	return seconds;
}

/**
 * Reads Strong's "YYYY-MM-DD HH:MM:SS" as local time on this device: the
 * export has no time zone, and it was written in the lifter's own zone.
 */
export function parseStrongDate(text: string): number | undefined {
	const match =
		/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
			text.trim(),
		);
	if (!match) return undefined;
	const [year, month, day, hour, minute, second] = match
		.slice(1)
		.map((part) => Number(part ?? 0));
	if (
		year === undefined ||
		month === undefined ||
		day === undefined ||
		hour === undefined ||
		minute === undefined ||
		second === undefined ||
		hour > LAST_HOUR ||
		minute > LAST_MINUTE ||
		second > LAST_MINUTE
	) {
		return undefined;
	}
	const date = new Date(year, month - 1, day, hour, minute, second);
	// Reject dates that Date rolled over, such as 2026-02-30.
	if (date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
	return date.getTime();
}

/** A number, accepting a decimal comma; undefined when empty or not one. */
function parseNumber(text: string): number | undefined {
	const trimmed = text.trim();
	if (trimmed === "") return undefined;
	const value = Number(
		trimmed.includes(".") ? trimmed : trimmed.replace(",", "."),
	);
	return Number.isFinite(value) ? value : undefined;
}

/** Strong writes 0 for a field the exercise does not use. */
function parseMeasurement(text: string): number | undefined {
	const value = parseNumber(text);
	return value === 0 ? undefined : value;
}

function parseWeightUnit(text: string): WeightUnit | undefined {
	const unit = text.trim().toLowerCase();
	if (unit === "kg" || unit === "kgs") return "kg";
	if (unit === "lb" || unit === "lbs") return "lb";
	return undefined;
}

function parseDistanceUnit(text: string): DistanceUnit | undefined {
	const unit = text.trim().toLowerCase();
	if (unit === "m" || unit === "meters" || unit === "metres") return "m";
	if (unit === "km" || unit === "kilometers" || unit === "kilometres")
		return "km";
	if (unit === "mi" || unit === "miles") return "mi";
	return undefined;
}

// ---------------------------------------------------------------- header

/** Column positions in this export; undefined when it lacks the column. */
interface Columns {
	count: number;
	date: number;
	workoutName: number;
	exerciseName: number;
	workoutNumber: number | undefined;
	duration: number | undefined;
	/** The duration column holds plain seconds ("Duration (sec)"). */
	durationInSeconds: boolean;
	setOrder: number | undefined;
	weight: number | undefined;
	weightUnit: number | undefined;
	reps: number | undefined;
	distance: number | undefined;
	distanceUnit: number | undefined;
	seconds: number | undefined;
	notes: number | undefined;
	workoutNotes: number | undefined;
	rpe: number | undefined;
	/** From a header such as "Weight (lbs)". */
	headerWeightUnit: WeightUnit | undefined;
	/** From a header such as "Distance (miles)". */
	headerDistanceUnit: DistanceUnit | undefined;
}

const REQUIRED_COLUMNS = ["Date", "Workout Name", "Exercise Name"];

/** Splits "Weight (lbs)" into "weight" and "lbs". */
function splitHeader(text: string): { name: string; unit: string } {
	const trimmed = text.trim();
	const match = /^(.*?)\s*\(([^)]*)\)$/.exec(trimmed);
	return {
		name: (match?.[1] ?? trimmed).toLowerCase(),
		unit: match?.[2] ?? "",
	};
}

/** Strong has named its columns differently across versions. */
function findColumns(header: string[]): Columns | string {
	const index = new Map<string, number>();
	const units = new Map<string, string>();
	header.forEach((cell, i) => {
		const { name, unit } = splitHeader(cell);
		if (index.has(name)) return;
		index.set(name, i);
		units.set(name, unit);
	});
	const date = index.get("date");
	const workoutName = index.get("workout name");
	const exerciseName = index.get("exercise name");
	if (
		date === undefined ||
		workoutName === undefined ||
		exerciseName === undefined
	) {
		const missing = REQUIRED_COLUMNS.filter(
			(name) => !index.has(name.toLowerCase()),
		);
		return `Not a Strong export: missing columns ${missing.join(", ")}`;
	}
	const durationName = index.has("duration") ? "duration" : "workout duration";
	const durationUnit = units.get(durationName)?.toLowerCase();
	return {
		count: header.length,
		date,
		workoutName,
		exerciseName,
		workoutNumber: index.get("workout #"),
		duration: index.get(durationName),
		durationInSeconds: durationUnit === "sec" || durationUnit === "s",
		setOrder: index.get("set order"),
		weight: index.get("weight"),
		weightUnit: index.get("weight unit"),
		reps: index.get("reps"),
		distance: index.get("distance"),
		distanceUnit: index.get("distance unit"),
		seconds: index.get("seconds"),
		notes: index.get("notes"),
		workoutNotes: index.get("workout notes"),
		rpe: index.get("rpe"),
		headerWeightUnit: parseWeightUnit(units.get("weight") ?? ""),
		headerDistanceUnit: parseDistanceUnit(units.get("distance") ?? ""),
	};
}

/** Older exports in some locales use semicolons (and decimal commas). */
function detectDelimiter(text: string): string {
	const headerLine = text.split(/\r?\n/, 1)[0] ?? "";
	return headerLine.includes(";") && !headerLine.includes(",") ? ";" : ",";
}

// ---------------------------------------------------------------- rows

const REST_TIMER = "rest timer";

interface Units {
	weight: WeightUnit | undefined;
	distance: DistanceUnit | undefined;
}

type RowOutcome =
	| { kind: "skip"; reason: string }
	| {
			kind: "set";
			workoutKey: string;
			workoutName: string;
			startedAt: number;
			durationText: string;
			workoutNotes: string;
			exerciseName: string;
			set: StrongSet;
			missingUnits: UnitKind[];
	  };

function readCell(fields: string[], column: number | undefined): string {
	return column === undefined ? "" : (fields[column] ?? "").trim();
}

function readSet(
	cell: (column: number | undefined) => string,
	columns: Columns,
	fallback: Units,
): { set: StrongSet; missingUnits: UnitKind[] } {
	const set: StrongSet = {};
	const missingUnits: UnitKind[] = [];

	const weight = parseMeasurement(cell(columns.weight));
	if (weight !== undefined) {
		const unit = parseWeightUnit(cell(columns.weightUnit)) ?? fallback.weight;
		if (unit === undefined) missingUnits.push("weight");
		else set.weightKg = unit === "lb" ? weight * KG_PER_LB : weight;
	}
	const reps = parseMeasurement(cell(columns.reps));
	if (reps !== undefined) set.reps = reps;
	const distance = parseMeasurement(cell(columns.distance));
	if (distance !== undefined) {
		const unit =
			parseDistanceUnit(cell(columns.distanceUnit)) ?? fallback.distance;
		if (unit === undefined) missingUnits.push("distance");
		else set.distanceM = distance * METRES_PER[unit];
	}
	const seconds = parseMeasurement(cell(columns.seconds));
	if (seconds !== undefined) set.seconds = seconds;
	const rpe = parseMeasurement(cell(columns.rpe));
	if (rpe !== undefined) set.rpe = rpe;
	const notes = cell(columns.notes);
	if (notes !== "") set.notes = notes;
	return { set, missingUnits };
}

/** A measurement that is filled in but not a number would be lost silently. */
function findInvalidNumber(
	cell: (column: number | undefined) => string,
	columns: Columns,
): string | undefined {
	const measurements: [string, number | undefined][] = [
		["weight", columns.weight],
		["reps", columns.reps],
		["distance", columns.distance],
		["seconds", columns.seconds],
		["RPE", columns.rpe],
	];
	for (const [label, column] of measurements) {
		const text = cell(column);
		if (text !== "" && parseNumber(text) === undefined) {
			return `Invalid ${label} "${text}"`;
		}
	}
	return undefined;
}

function readRow(
	record: CsvRecord,
	columns: Columns,
	fallback: Units,
): RowOutcome {
	const { fields } = record;
	if (fields.length !== columns.count) {
		return {
			kind: "skip",
			reason: `Expected ${columns.count} columns, found ${fields.length}`,
		};
	}
	const cell = (column: number | undefined) => readCell(fields, column);
	// Newer exports log each rest as a row of its own; it is not a set.
	if (cell(columns.setOrder).toLowerCase() === REST_TIMER) {
		return { kind: "skip", reason: "Rest timer row" };
	}
	const dateText = cell(columns.date);
	const startedAt = parseStrongDate(dateText);
	if (startedAt === undefined) {
		return { kind: "skip", reason: `Invalid date "${dateText}"` };
	}
	const exerciseName = cell(columns.exerciseName);
	if (exerciseName === "") {
		return { kind: "skip", reason: "Missing exercise name" };
	}
	const invalidNumber = findInvalidNumber(cell, columns);
	if (invalidNumber) return { kind: "skip", reason: invalidNumber };
	const workoutName = cell(columns.workoutName);
	return {
		kind: "set",
		workoutKey: [cell(columns.workoutNumber), dateText, workoutName].join("\n"),
		workoutName,
		startedAt,
		durationText: cell(columns.duration),
		workoutNotes: cell(columns.workoutNotes),
		exerciseName,
		...readSet(cell, columns, fallback),
	};
}

function readDurationSeconds(text: string, columns: Columns): number {
	const seconds = columns.durationInSeconds
		? parseNumber(text)
		: parseStrongDuration(text);
	return seconds !== undefined && seconds > 0 ? seconds : 0;
}

// ---------------------------------------------------------------- parse

/**
 * Parses a Strong CSV export. Rows that cannot be used are listed in
 * `skipped`; the rest are grouped by workout (date and name) in file order,
 * and within a workout into runs of the same exercise.
 */
export function parseStrongCsv(
	text: string,
	options: StrongParseOptions = {},
): StrongParseResult {
	const [header, ...rows] = parseCsvRecords(text, detectDelimiter(text));
	if (!header) return { kind: PARSE_KIND.invalid, reason: "The file is empty" };
	const columns = findColumns(header.fields);
	if (typeof columns === "string") {
		return { kind: PARSE_KIND.invalid, reason: columns };
	}
	const fallback: Units = {
		weight: columns.headerWeightUnit ?? options.weightUnit,
		distance: columns.headerDistanceUnit ?? options.distanceUnit,
	};

	const workouts = new Map<string, StrongWorkout>();
	const skipped: SkippedRow[] = [];
	const missing = new Set<UnitKind>();
	for (const record of rows) {
		const row = readRow(record, columns, fallback);
		if (row.kind === "skip") {
			skipped.push({ line: record.line, reason: row.reason });
			continue;
		}
		for (const unit of row.missingUnits) missing.add(unit);

		let workout = workouts.get(row.workoutKey);
		if (!workout) {
			const duration = readDurationSeconds(row.durationText, columns);
			workout = {
				name: row.workoutName,
				startedAt: row.startedAt,
				endedAt: row.startedAt + duration * MS_PER_SECOND,
				exercises: [],
			};
			workouts.set(row.workoutKey, workout);
		}
		if (workout.notes === undefined && row.workoutNotes !== "") {
			workout.notes = row.workoutNotes;
		}
		const last = workout.exercises.at(-1);
		if (last?.name === row.exerciseName) last.sets.push(row.set);
		else workout.exercises.push({ name: row.exerciseName, sets: [row.set] });
	}

	if (missing.size > 0) {
		const order: UnitKind[] = ["weight", "distance"];
		return {
			kind: PARSE_KIND.needsUnits,
			missing: order.filter((unit) => missing.has(unit)),
		};
	}
	return {
		kind: PARSE_KIND.parsed,
		workouts: [...workouts.values()],
		skipped,
		...(fallback.weight ? { weightUnit: fallback.weight } : {}),
	};
}

/** The number of sets across the workouts, for an import summary. */
export function countSets(workouts: StrongWorkout[]): number {
	return workouts.reduce(
		(total, workout) =>
			total +
			workout.exercises.reduce(
				(sum, exercise) => sum + exercise.sets.length,
				0,
			),
		0,
	);
}
