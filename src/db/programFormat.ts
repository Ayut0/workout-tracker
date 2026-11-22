import {
	BLOCK_KEYS,
	DAY_KEYS,
	EXERCISE_KEYS,
	INVISIBLE,
	MAX_PROGRAM_ERRORS,
	MEASURE_FIELDS,
	PROGRAM_FORMAT,
	PROGRAM_FORMAT_VERSION,
	PROGRAM_KEYS,
	PROGRAM_LIMITS,
	SET_KEYS,
	SET_MEASURES,
	SET_VALUE_FIELDS,
	TARGET_KEYS,
	WEEK_KEYS,
} from "./constants";
import { normalizeExerciseName } from "./index";
import type {
	JsonObject,
	ProgramFile,
	ProgramMeasures,
	ProgramParseResult,
	ProgramSet,
	SetMeasure,
} from "./types";
import { plansTargets } from "./workoutLog";

/**
 * Reading a program file (ADR-0019): a multi-week plan written outside the
 * app (often by an LLM from a backup) and imported as templates. Pure: writes
 * nothing. Unlike a backup, every problem is reported with its JSON path, so
 * a generated file can be fixed in one go.
 */

/** The problem with a file of `bytes` size, if it is over the limit. */
export function findFileSizeProblem(bytes: number): string | undefined {
	if (bytes <= PROGRAM_LIMITS.maxFileBytes) return undefined;
	const megabytes = PROGRAM_LIMITS.maxFileBytes / (1024 * 1024);
	return `The file is larger than ${megabytes} MB, the most a program file may be.`;
}

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
	return (
		typeof value === "string" && value.replace(INVISIBLE, "").trim() !== ""
	);
}

/** Collapses runs of whitespace, as stored names are (tidyTemplateName). */
function tidySpaces(text: string): string {
	return text.trim().replace(/\s+/g, " ");
}

function isCount(value: unknown, min: number): value is number {
	return Number.isInteger(value) && Number(value) >= min;
}

function isAmount(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isMeasure(value: unknown): value is SetMeasure {
	return SET_MEASURES.some((measure) => measure === value);
}

/** Adds a problem, prefixed with the JSON path it is about. */
function addProblem(problems: string[], path: string, problem: string) {
	problems.push(path === "" ? problem : `${path}: ${problem}`);
}

/** Reports fields the format does not know, naming the ones it does. */
function checkUnknownKeys(
	problems: string[],
	path: string,
	value: JsonObject,
	known: readonly string[],
) {
	for (const key of Object.keys(value)) {
		if (!known.includes(key)) {
			addProblem(
				problems,
				joinPath(path, key),
				`unknown field. Allowed here: ${known.join(", ")}.`,
			);
		}
	}
}

/**
 * A non-empty list of at most `max` items at `path`, or undefined after
 * reporting why not. A list over its limit is not looked into.
 */
function readNonEmptyList(
	problems: string[],
	path: string,
	value: unknown,
	max: number,
): unknown[] | undefined {
	if (!Array.isArray(value)) {
		addProblem(problems, path, "must be a list.");
		return undefined;
	}
	if (value.length === 0) {
		addProblem(problems, path, "must not be empty.");
		return undefined;
	}
	if (value.length > max) {
		addProblem(
			problems,
			path,
			`has ${value.length} items; at most ${max} are allowed.`,
		);
		return undefined;
	}
	return value;
}

/** Reports text longer than `max` characters. */
function checkLength(
	problems: string[],
	path: string,
	text: string,
	max: number,
) {
	if (text.length > max) {
		addProblem(
			problems,
			path,
			`must be at most ${max} characters (it has ${text.length}).`,
		);
	}
}

/** Checks a number, 0 or more and at most `max`; false after reporting. */
function checkAmount(
	problems: string[],
	path: string,
	value: unknown,
	max: number,
): boolean {
	if (!isAmount(value)) {
		addProblem(problems, path, "must be a number, 0 or more.");
		return false;
	}
	if (value > max) {
		addProblem(problems, path, `must be at most ${max}.`);
		return false;
	}
	return true;
}

/** Checks a whole number from `min` to `max`; false after reporting. */
function checkCount(
	problems: string[],
	path: string,
	value: unknown,
	min: number,
	max: number,
): boolean {
	if (!isCount(value, min)) {
		addProblem(
			problems,
			path,
			min === 0
				? "must be a whole number, 0 or more."
				: `must be a whole number, ${min} or more.`,
		);
		return false;
	}
	if (value > max) {
		addProblem(problems, path, `must be at most ${max}.`);
		return false;
	}
	return true;
}

/** An object at `path`, or undefined after reporting it is not one. */
function readObject(
	problems: string[],
	path: string,
	value: unknown,
): JsonObject | undefined {
	if (isObject(value)) return value;
	addProblem(problems, path, "must be an object.");
	return undefined;
}

function joinPath(path: string, key: string): string {
	return path === "" ? key : `${path}.${key}`;
}

function joinIndexPath(path: string, i: number): string {
	return `${path}[${i}]`;
}

/** The measure each exercise name is given, by normalized name. */
/** Whether sets of `measure` use `field` (a warm-up mark is always used). */
function usesSetField(measure: SetMeasure, field: string): boolean {
	return TARGET_KEYS.some((key) => key === field)
		? plansTargets(measure)
		: MEASURE_FIELDS[measure].some((used) => used === field);
}

/** The set's fields that sets of `measure` do not use. */
export function findUnusedSetFields(
	set: ProgramSet,
	measure: SetMeasure,
): (typeof SET_VALUE_FIELDS)[number][] {
	return SET_VALUE_FIELDS.filter(
		(field) => set[field] !== undefined && !usesSetField(measure, field),
	);
}

/** Why `measure` cannot hold a field, without a closing full stop. */
export function describeUnusedField(measure: SetMeasure): string {
	return `is not used by the measure "${measure}" (it uses ${MEASURE_FIELDS[measure].join(", ")})`;
}

/**
 * Checks a planned set. `measure` is the one the file states for the
 * exercise; undefined when it states none, then fields are not checked
 * against a measure: the import checks them against the library's (or the
 * default for a new exercise).
 */
function checkSet(
	path: string,
	value: unknown,
	measure: SetMeasure | undefined,
	problems: string[],
) {
	const set = readObject(problems, path, value);
	if (!set) return;
	checkUnknownKeys(problems, path, set, SET_KEYS);
	const checkUsed = (field: string) => {
		if (measure !== undefined && !usesSetField(measure, field)) {
			addProblem(
				problems,
				joinPath(path, field),
				`${describeUnusedField(measure)}.`,
			);
		}
	};
	const maxima = {
		weightKg: PROGRAM_LIMITS.maxWeightKg,
		seconds: PROGRAM_LIMITS.maxSeconds,
		distanceM: PROGRAM_LIMITS.maxDistanceM,
	} as const;
	for (const field of ["weightKg", "seconds", "distanceM"] as const) {
		const amount = set[field];
		if (amount === undefined) continue;
		if (checkAmount(problems, joinPath(path, field), amount, maxima[field])) {
			checkUsed(field);
		}
	}
	const maxCounts = {
		reps: PROGRAM_LIMITS.maxReps,
		repMin: PROGRAM_LIMITS.maxReps,
		repMax: PROGRAM_LIMITS.maxReps,
		targetRir: PROGRAM_LIMITS.maxTargetRir,
	} as const;
	for (const field of ["reps", ...TARGET_KEYS] as const) {
		const amount = set[field];
		if (amount === undefined) continue;
		if (
			checkCount(problems, joinPath(path, field), amount, 0, maxCounts[field])
		) {
			checkUsed(field);
		}
	}
	if (set.warmup !== undefined && typeof set.warmup !== "boolean") {
		addProblem(problems, joinPath(path, "warmup"), "must be true or false.");
	}
	const { reps, repMin, repMax } = set;
	if ((repMin === undefined) !== (repMax === undefined)) {
		addProblem(
			problems,
			path,
			"repMin and repMax must be given together (for exactly 8 reps, give 8 and 8).",
		);
	} else if (
		isCount(repMin, 0) &&
		isCount(repMax, 0) &&
		Number(repMin) > Number(repMax)
	) {
		addProblem(
			problems,
			path,
			`repMin (${repMin}) must not be more than repMax (${repMax}).`,
		);
	}
	if (reps !== undefined && (repMin !== undefined || repMax !== undefined)) {
		addProblem(
			problems,
			path,
			"give either reps or a repMin and repMax range, not both.",
		);
	}
}

/**
 * Checks an exercise's name and measure, and remembers the measure so the
 * same exercise is not given two. Returns the measure the file states:
 * undefined when none is given anywhere, null when the one given is invalid.
 */
function checkExercise(
	path: string,
	exercise: JsonObject,
	measures: ProgramMeasures,
	problems: string[],
): SetMeasure | null | undefined {
	checkUnknownKeys(problems, path, exercise, EXERCISE_KEYS);
	if (typeof exercise.notes === "string") {
		checkLength(
			problems,
			joinPath(path, "notes"),
			exercise.notes,
			PROGRAM_LIMITS.maxNotesLength,
		);
	} else if (exercise.notes !== undefined) {
		addProblem(problems, joinPath(path, "notes"), "must be text.");
	}
	if (exercise.measure !== undefined && !isMeasure(exercise.measure)) {
		addProblem(
			problems,
			joinPath(path, "measure"),
			`must be one of ${SET_MEASURES.map((m) => `"${m}"`).join(", ")}.`,
		);
		return null;
	}
	if (!isText(exercise.name)) {
		addProblem(
			problems,
			joinPath(path, "name"),
			"must be a non-empty exercise name.",
		);
		return exercise.measure;
	}
	checkLength(
		problems,
		joinPath(path, "name"),
		exercise.name,
		PROGRAM_LIMITS.maxNameLength,
	);
	const key = normalizeExerciseName(exercise.name);
	const seen = measures.get(key);
	if (exercise.measure === undefined) return seen?.measure;
	if (seen && seen.measure !== exercise.measure) {
		addProblem(
			problems,
			joinPath(path, "measure"),
			`"${exercise.measure}" differs from "${seen.measure}" given for "${exercise.name}" at ${seen.path}; an exercise has one measure.`,
		);
		return seen.measure;
	}
	if (!seen) {
		measures.set(key, {
			measure: exercise.measure,
			path: joinPath(path, "measure"),
		});
	}
	return exercise.measure;
}

/**
 * First pass: the measure given for each exercise name, wherever it is
 * given, so sets listed before the measure is named are still checked
 * against it.
 */
function collectMeasures(blocks: unknown): ProgramMeasures {
	const measures: ProgramMeasures = new Map();
	// Problems are reported by the second pass, in file order.
	const scratch: string[] = [];
	if (!Array.isArray(blocks)) return measures;
	blocks.forEach((block, b) => {
		if (!isObject(block) || !Array.isArray(block.weeks)) return;
		block.weeks.forEach((week, w) => {
			if (!isObject(week) || !Array.isArray(week.days)) return;
			week.days.forEach((day, d) => {
				if (!isObject(day) || !Array.isArray(day.exercises)) return;
				day.exercises.forEach((exercise, e) => {
					if (!isObject(exercise)) return;
					const path = `blocks[${b}].weeks[${w}].days[${d}].exercises[${e}]`;
					checkExercise(path, exercise, measures, scratch);
				});
			});
		});
	});
	return measures;
}

function checkDay(
	path: string,
	value: unknown,
	measures: ProgramMeasures,
	problems: string[],
): string | undefined {
	const day = readObject(problems, path, value);
	if (!day) return undefined;
	checkUnknownKeys(problems, path, day, DAY_KEYS);
	if (isText(day.day)) {
		checkLength(
			problems,
			joinPath(path, "day"),
			day.day,
			PROGRAM_LIMITS.maxIdLength,
		);
	} else {
		addProblem(
			problems,
			joinPath(path, "day"),
			'must be a short non-empty id, such as "A".',
		);
	}
	if (isText(day.name)) {
		checkLength(
			problems,
			joinPath(path, "name"),
			day.name,
			PROGRAM_LIMITS.maxNameLength,
		);
	} else if (day.name !== undefined) {
		addProblem(
			problems,
			joinPath(path, "name"),
			"must be non-empty text when given.",
		);
	}
	const exercises = readNonEmptyList(
		problems,
		joinPath(path, "exercises"),
		day.exercises,
		PROGRAM_LIMITS.maxExercisesPerDay,
	);
	exercises?.forEach((item, e) => {
		const exercisePath = joinIndexPath(joinPath(path, "exercises"), e);
		const exercise = readObject(problems, exercisePath, item);
		if (!exercise) return;
		const given = checkExercise(exercisePath, exercise, measures, problems);
		const measure = given === null ? undefined : given;
		const setsPath = joinPath(exercisePath, "sets");
		const sets = readNonEmptyList(
			problems,
			setsPath,
			exercise.sets,
			PROGRAM_LIMITS.maxSetsPerExercise,
		);
		sets?.forEach((set, s) => {
			checkSet(joinIndexPath(setsPath, s), set, measure, problems);
		});
	});
	return isText(day.day) ? tidySpaces(day.day) : undefined;
}

function checkWeek(
	path: string,
	value: unknown,
	measures: ProgramMeasures,
	problems: string[],
): number | undefined {
	const week = readObject(problems, path, value);
	if (!week) return undefined;
	checkUnknownKeys(problems, path, week, WEEK_KEYS);
	checkCount(
		problems,
		joinPath(path, "week"),
		week.week,
		1,
		PROGRAM_LIMITS.maxWeekNumber,
	);
	if (week.deload !== undefined && typeof week.deload !== "boolean") {
		addProblem(problems, joinPath(path, "deload"), "must be true or false.");
	}
	const daysPath = joinPath(path, "days");
	const days = readNonEmptyList(
		problems,
		daysPath,
		week.days,
		PROGRAM_LIMITS.maxDaysPerWeek,
	);
	const seen = new Map<string, number>();
	days?.forEach((day, d) => {
		const id = checkDay(joinIndexPath(daysPath, d), day, measures, problems);
		if (id === undefined) return;
		const first = seen.get(id);
		if (first !== undefined) {
			addProblem(
				problems,
				joinPath(joinIndexPath(daysPath, d), "day"),
				`"${id}" is used twice in this week (also ${joinIndexPath(daysPath, first)}).`,
			);
		} else {
			seen.set(id, d);
		}
	});
	return isCount(week.week, 1) ? week.week : undefined;
}

function checkBlock(
	path: string,
	value: unknown,
	measures: ProgramMeasures,
	problems: string[],
): number | undefined {
	const block = readObject(problems, path, value);
	if (!block) return undefined;
	checkUnknownKeys(problems, path, block, BLOCK_KEYS);
	checkCount(
		problems,
		joinPath(path, "block"),
		block.block,
		1,
		PROGRAM_LIMITS.maxBlockNumber,
	);
	const weeksPath = joinPath(path, "weeks");
	const weeks = readNonEmptyList(
		problems,
		weeksPath,
		block.weeks,
		PROGRAM_LIMITS.maxWeeksPerBlock,
	);
	const seen = new Map<number, number>();
	weeks?.forEach((week, w) => {
		const number = checkWeek(
			joinIndexPath(weeksPath, w),
			week,
			measures,
			problems,
		);
		if (number === undefined) return;
		const first = seen.get(number);
		if (first !== undefined) {
			addProblem(
				problems,
				joinPath(joinIndexPath(weeksPath, w), "week"),
				`week ${number} is used twice in this block (also ${joinIndexPath(weeksPath, first)}).`,
			);
		} else {
			seen.set(number, w);
		}
	});
	return isCount(block.block, 1) ? block.block : undefined;
}

function checkEnvelope(file: JsonObject, problems: string[]): boolean {
	if (file.format !== PROGRAM_FORMAT) {
		addProblem(problems, "format", `must be "${PROGRAM_FORMAT}".`);
		return false;
	}
	if (!isCount(file.formatVersion, 1)) {
		addProblem(problems, "formatVersion", "must be a whole number, 1 or more.");
		return false;
	}
	if (file.formatVersion > PROGRAM_FORMAT_VERSION) {
		addProblem(
			problems,
			"formatVersion",
			`${file.formatVersion} is newer than this app reads (${PROGRAM_FORMAT_VERSION}). Update the app, or write version ${PROGRAM_FORMAT_VERSION}.`,
		);
		return false;
	}
	return true;
}

/** How many days the blocks hold: one template each. Non-lists count 0. */
function countTemplates(blocks: unknown[]): number {
	let count = 0;
	for (const block of blocks) {
		if (!isObject(block) || !Array.isArray(block.weeks)) continue;
		for (const week of block.weeks) {
			if (isObject(week) && Array.isArray(week.days)) count += week.days.length;
		}
	}
	return count;
}

/** The problems with a program file; empty when it can be imported. */
function findProblems(file: JsonObject): string[] {
	const problems: string[] = [];
	if (!checkEnvelope(file, problems)) return problems;
	checkUnknownKeys(problems, "", file, PROGRAM_KEYS);
	if (isText(file.programId)) {
		checkLength(
			problems,
			"programId",
			file.programId,
			PROGRAM_LIMITS.maxIdLength,
		);
	} else {
		addProblem(
			problems,
			"programId",
			'must be a non-empty id that stays the same for every block of the program, such as "upper-lower-2026".',
		);
	}
	if (isText(file.name)) {
		checkLength(problems, "name", file.name, PROGRAM_LIMITS.maxNameLength);
	} else {
		addProblem(problems, "name", "must be a non-empty name.");
	}
	const blocks = readNonEmptyList(
		problems,
		"blocks",
		file.blocks,
		PROGRAM_LIMITS.maxBlocks,
	);
	if (!blocks) return problems;
	const templates = countTemplates(blocks);
	if (templates > PROGRAM_LIMITS.maxTemplates) {
		addProblem(
			problems,
			"blocks",
			`would create ${templates} templates (one per block, week and day); at most ${PROGRAM_LIMITS.maxTemplates} are allowed.`,
		);
		return problems;
	}
	const measures = collectMeasures(blocks);
	const seen = new Map<number, number>();
	blocks.forEach((block, b) => {
		const number = checkBlock(
			joinIndexPath("blocks", b),
			block,
			measures,
			problems,
		);
		if (number === undefined) return;
		const first = seen.get(number);
		if (first !== undefined) {
			addProblem(
				problems,
				joinPath(joinIndexPath("blocks", b), "block"),
				`block ${number} is used twice (also blocks[${first}]).`,
			);
		} else {
			seen.set(number, b);
		}
	});
	return problems;
}

/** Shortens a long list of problems, saying how many were left out. */
export function capProblems(problems: string[]): string[] {
	if (problems.length <= MAX_PROGRAM_ERRORS) return problems;
	const rest = problems.length - MAX_PROGRAM_ERRORS;
	return [
		...problems.slice(0, MAX_PROGRAM_ERRORS),
		`…and ${rest} more ${rest === 1 ? "problem" : "problems"}.`,
	];
}

/** Whether a checked object is a program file: it has no problems. */
function isProgramFile(
	file: JsonObject,
	problems: readonly string[],
): file is JsonObject & ProgramFile {
	return isObject(file) && problems.length === 0;
}

/** Parses and checks a program file's text; lists every problem found. */
export function parseProgram(fileText: string): ProgramParseResult {
	const tooLarge = findFileSizeProblem(fileText.length);
	if (tooLarge) return { ok: false, errors: [tooLarge] };
	let parsed: unknown;
	try {
		parsed = JSON.parse(fileText);
	} catch (error) {
		const detail = error instanceof Error ? ` (${error.message})` : "";
		return { ok: false, errors: [`The file is not valid JSON${detail}.`] };
	}
	if (!isObject(parsed)) {
		return {
			ok: false,
			errors: ["The file must hold one JSON object, the program."],
		};
	}
	const problems = findProblems(parsed);
	if (!isProgramFile(parsed, problems)) {
		return { ok: false, errors: capProblems(problems) };
	}
	return { ok: true, program: parsed };
}
