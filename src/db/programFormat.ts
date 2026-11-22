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
export function programFileSizeProblem(bytes: number): string | undefined {
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

/** Collects problems, each prefixed with the JSON path it is about. */
class Problems {
	readonly messages: string[] = [];

	add(path: string, problem: string) {
		this.messages.push(path === "" ? problem : `${path}: ${problem}`);
	}

	/** Reports fields the format does not know, naming the ones it does. */
	unknownKeys(path: string, value: JsonObject, known: readonly string[]) {
		for (const key of Object.keys(value)) {
			if (!known.includes(key)) {
				this.add(
					join(path, key),
					`unknown field. Allowed here: ${known.join(", ")}.`,
				);
			}
		}
	}

	/**
	 * A non-empty list of at most `max` items at `path`, or undefined after
	 * reporting why not. A list over its limit is not looked into.
	 */
	nonEmptyList(
		path: string,
		value: unknown,
		max: number,
	): unknown[] | undefined {
		if (!Array.isArray(value)) {
			this.add(path, "must be a list.");
			return undefined;
		}
		if (value.length === 0) {
			this.add(path, "must not be empty.");
			return undefined;
		}
		if (value.length > max) {
			this.add(path, `has ${value.length} items; at most ${max} are allowed.`);
			return undefined;
		}
		return value;
	}

	/** Reports text longer than `max` characters. */
	length(path: string, text: string, max: number) {
		if (text.length > max) {
			this.add(
				path,
				`must be at most ${max} characters (it has ${text.length}).`,
			);
		}
	}

	/** Checks a number, 0 or more and at most `max`; false after reporting. */
	amount(path: string, value: unknown, max: number): boolean {
		if (!isAmount(value)) {
			this.add(path, "must be a number, 0 or more.");
			return false;
		}
		if (value > max) {
			this.add(path, `must be at most ${max}.`);
			return false;
		}
		return true;
	}

	/** Checks a whole number from `min` to `max`; false after reporting. */
	count(path: string, value: unknown, min: number, max: number): boolean {
		if (!isCount(value, min)) {
			this.add(
				path,
				min === 0
					? "must be a whole number, 0 or more."
					: `must be a whole number, ${min} or more.`,
			);
			return false;
		}
		if (value > max) {
			this.add(path, `must be at most ${max}.`);
			return false;
		}
		return true;
	}

	/** An object at `path`, or undefined after reporting it is not one. */
	object(path: string, value: unknown): JsonObject | undefined {
		if (isObject(value)) return value;
		this.add(path, "must be an object.");
		return undefined;
	}
}

function join(path: string, key: string): string {
	return path === "" ? key : `${path}.${key}`;
}

function index(path: string, i: number): string {
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
export function unusedSetFields(
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
	problems: Problems,
) {
	const set = problems.object(path, value);
	if (!set) return;
	problems.unknownKeys(path, set, SET_KEYS);
	const checkUsed = (field: string) => {
		if (measure !== undefined && !usesSetField(measure, field)) {
			problems.add(join(path, field), `${describeUnusedField(measure)}.`);
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
		if (problems.amount(join(path, field), amount, maxima[field])) {
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
		if (problems.count(join(path, field), amount, 0, maxCounts[field])) {
			checkUsed(field);
		}
	}
	if (set.warmup !== undefined && typeof set.warmup !== "boolean") {
		problems.add(join(path, "warmup"), "must be true or false.");
	}
	const { reps, repMin, repMax } = set;
	if ((repMin === undefined) !== (repMax === undefined)) {
		problems.add(
			path,
			"repMin and repMax must be given together (for exactly 8 reps, give 8 and 8).",
		);
	} else if (
		isCount(repMin, 0) &&
		isCount(repMax, 0) &&
		Number(repMin) > Number(repMax)
	) {
		problems.add(
			path,
			`repMin (${repMin}) must not be more than repMax (${repMax}).`,
		);
	}
	if (reps !== undefined && (repMin !== undefined || repMax !== undefined)) {
		problems.add(
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
	problems: Problems,
): SetMeasure | null | undefined {
	problems.unknownKeys(path, exercise, EXERCISE_KEYS);
	if (typeof exercise.notes === "string") {
		problems.length(
			join(path, "notes"),
			exercise.notes,
			PROGRAM_LIMITS.maxNotesLength,
		);
	} else if (exercise.notes !== undefined) {
		problems.add(join(path, "notes"), "must be text.");
	}
	if (exercise.measure !== undefined && !isMeasure(exercise.measure)) {
		problems.add(
			join(path, "measure"),
			`must be one of ${SET_MEASURES.map((m) => `"${m}"`).join(", ")}.`,
		);
		return null;
	}
	if (!isText(exercise.name)) {
		problems.add(join(path, "name"), "must be a non-empty exercise name.");
		return exercise.measure;
	}
	problems.length(
		join(path, "name"),
		exercise.name,
		PROGRAM_LIMITS.maxNameLength,
	);
	const key = normalizeExerciseName(exercise.name);
	const seen = measures.get(key);
	if (exercise.measure === undefined) return seen?.measure;
	if (seen && seen.measure !== exercise.measure) {
		problems.add(
			join(path, "measure"),
			`"${exercise.measure}" differs from "${seen.measure}" given for "${exercise.name}" at ${seen.path}; an exercise has one measure.`,
		);
		return seen.measure;
	}
	if (!seen) {
		measures.set(key, {
			measure: exercise.measure,
			path: join(path, "measure"),
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
	const scratch = new Problems();
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
	problems: Problems,
): string | undefined {
	const day = problems.object(path, value);
	if (!day) return undefined;
	problems.unknownKeys(path, day, DAY_KEYS);
	if (isText(day.day)) {
		problems.length(join(path, "day"), day.day, PROGRAM_LIMITS.maxIdLength);
	} else {
		problems.add(
			join(path, "day"),
			'must be a short non-empty id, such as "A".',
		);
	}
	if (isText(day.name)) {
		problems.length(join(path, "name"), day.name, PROGRAM_LIMITS.maxNameLength);
	} else if (day.name !== undefined) {
		problems.add(join(path, "name"), "must be non-empty text when given.");
	}
	const exercises = problems.nonEmptyList(
		join(path, "exercises"),
		day.exercises,
		PROGRAM_LIMITS.maxExercisesPerDay,
	);
	exercises?.forEach((item, e) => {
		const exercisePath = index(join(path, "exercises"), e);
		const exercise = problems.object(exercisePath, item);
		if (!exercise) return;
		const given = checkExercise(exercisePath, exercise, measures, problems);
		const measure = given === null ? undefined : given;
		const setsPath = join(exercisePath, "sets");
		const sets = problems.nonEmptyList(
			setsPath,
			exercise.sets,
			PROGRAM_LIMITS.maxSetsPerExercise,
		);
		sets?.forEach((set, s) => {
			checkSet(index(setsPath, s), set, measure, problems);
		});
	});
	return isText(day.day) ? tidySpaces(day.day) : undefined;
}

function checkWeek(
	path: string,
	value: unknown,
	measures: ProgramMeasures,
	problems: Problems,
): number | undefined {
	const week = problems.object(path, value);
	if (!week) return undefined;
	problems.unknownKeys(path, week, WEEK_KEYS);
	problems.count(
		join(path, "week"),
		week.week,
		1,
		PROGRAM_LIMITS.maxWeekNumber,
	);
	if (week.deload !== undefined && typeof week.deload !== "boolean") {
		problems.add(join(path, "deload"), "must be true or false.");
	}
	const daysPath = join(path, "days");
	const days = problems.nonEmptyList(
		daysPath,
		week.days,
		PROGRAM_LIMITS.maxDaysPerWeek,
	);
	const seen = new Map<string, number>();
	days?.forEach((day, d) => {
		const id = checkDay(index(daysPath, d), day, measures, problems);
		if (id === undefined) return;
		const first = seen.get(id);
		if (first !== undefined) {
			problems.add(
				join(index(daysPath, d), "day"),
				`"${id}" is used twice in this week (also ${index(daysPath, first)}).`,
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
	problems: Problems,
): number | undefined {
	const block = problems.object(path, value);
	if (!block) return undefined;
	problems.unknownKeys(path, block, BLOCK_KEYS);
	problems.count(
		join(path, "block"),
		block.block,
		1,
		PROGRAM_LIMITS.maxBlockNumber,
	);
	const weeksPath = join(path, "weeks");
	const weeks = problems.nonEmptyList(
		weeksPath,
		block.weeks,
		PROGRAM_LIMITS.maxWeeksPerBlock,
	);
	const seen = new Map<number, number>();
	weeks?.forEach((week, w) => {
		const number = checkWeek(index(weeksPath, w), week, measures, problems);
		if (number === undefined) return;
		const first = seen.get(number);
		if (first !== undefined) {
			problems.add(
				join(index(weeksPath, w), "week"),
				`week ${number} is used twice in this block (also ${index(weeksPath, first)}).`,
			);
		} else {
			seen.set(number, w);
		}
	});
	return isCount(block.block, 1) ? block.block : undefined;
}

function checkEnvelope(file: JsonObject, problems: Problems): boolean {
	if (file.format !== PROGRAM_FORMAT) {
		problems.add("format", `must be "${PROGRAM_FORMAT}".`);
		return false;
	}
	if (!isCount(file.formatVersion, 1)) {
		problems.add("formatVersion", "must be a whole number, 1 or more.");
		return false;
	}
	if (file.formatVersion > PROGRAM_FORMAT_VERSION) {
		problems.add(
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
	const problems = new Problems();
	if (!checkEnvelope(file, problems)) return problems.messages;
	problems.unknownKeys("", file, PROGRAM_KEYS);
	if (isText(file.programId)) {
		problems.length("programId", file.programId, PROGRAM_LIMITS.maxIdLength);
	} else {
		problems.add(
			"programId",
			'must be a non-empty id that stays the same for every block of the program, such as "upper-lower-2026".',
		);
	}
	if (isText(file.name)) {
		problems.length("name", file.name, PROGRAM_LIMITS.maxNameLength);
	} else {
		problems.add("name", "must be a non-empty name.");
	}
	const blocks = problems.nonEmptyList(
		"blocks",
		file.blocks,
		PROGRAM_LIMITS.maxBlocks,
	);
	if (!blocks) return problems.messages;
	const templates = countTemplates(blocks);
	if (templates > PROGRAM_LIMITS.maxTemplates) {
		problems.add(
			"blocks",
			`would create ${templates} templates (one per block, week and day); at most ${PROGRAM_LIMITS.maxTemplates} are allowed.`,
		);
		return problems.messages;
	}
	const measures = collectMeasures(blocks);
	const seen = new Map<number, number>();
	blocks.forEach((block, b) => {
		const number = checkBlock(index("blocks", b), block, measures, problems);
		if (number === undefined) return;
		const first = seen.get(number);
		if (first !== undefined) {
			problems.add(
				join(index("blocks", b), "block"),
				`block ${number} is used twice (also blocks[${first}]).`,
			);
		} else {
			seen.set(number, b);
		}
	});
	return problems.messages;
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
	const tooLarge = programFileSizeProblem(fileText.length);
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
