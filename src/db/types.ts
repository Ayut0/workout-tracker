/**
 * Records stored on the device in IndexedDB.
 *
 * Conventions (ADR-0002):
 * - ids are random strings (`crypto.randomUUID()`), never auto-increment.
 * - times are epoch milliseconds.
 * - weight is stored in kilograms, unrounded; kg/lb conversion and rounding
 *   happen at display and input. Distance is stored in metres.
 * - order within a parent is an integer `order` field, read back sorted.
 */

import type { PROGRAM_FORMAT } from "./constants";

export type TimerStatus = "pending" | "received" | "cancelled" | "failed";

/** Names for the statuses; the type above is the source of truth. */
export const TIMER_STATUS = {
	pending: "pending",
	received: "received",
	cancelled: "cancelled",
	failed: "failed",
} as const satisfies { [S in TimerStatus]: S };

/**
 * One rest-timer notification, kept so we can measure how late the
 * lock-screen notification arrives. The service worker fills in receivedAt.
 */
export interface RestTimer {
	id: string;
	/** When the notification should fire (epoch ms). */
	scheduledAt: number;
	createdAt: number;
	status: TimerStatus;
	receivedAt?: number;
	error?: string;
}

/**
 * What a set of an exercise records (ADR-0012): weight and reps, reps alone
 * (bodyweight), seconds (a plank) or distance in metres (a carry, a row).
 */
export type SetMeasure = "weight-reps" | "reps" | "seconds" | "distance";

/** The set fields a measure can show. */
export type MeasureField = "weightKg" | "reps" | "seconds" | "distanceM";
/**
 * Muscle groups an exercise trains (ADR-0016); the list is MUSCLE_GROUPS. The
 * groups do not overlap, so a set can be counted once per group.
 */
export type MuscleGroup =
	| "chest"
	| "lats"
	| "upper-back"
	| "lower-back"
	| "front-delts"
	| "side-delts"
	| "rear-delts"
	| "biceps"
	| "triceps"
	| "forearms"
	| "abs"
	| "glutes"
	| "quads"
	| "hamstrings"
	| "adductors"
	| "calves";

/** The movement pattern of an exercise (ADR-0016). */
export type MovementPattern =
	| "squat"
	| "hinge"
	| "lunge"
	| "horizontal-push"
	| "vertical-push"
	| "horizontal-pull"
	| "vertical-pull"
	| "carry"
	| "rotation"
	| "isolation";

/** What kind of training an exercise is (ADR-0016). */
export type ExerciseCategory =
	| "strength"
	| "power"
	| "agility"
	| "mobility"
	| "core";

/** What an exercise is done with; decides the progression increment. */
export type Equipment =
	| "barbell"
	| "dumbbell"
	| "machine"
	| "cable"
	| "bodyweight"
	| "other";

/**
 * The optional, descriptive attributes of an exercise (ADR-0016). None is
 * indexed, so adding them needs no schema version. A muscle is either primary
 * or secondary, never both; an empty muscle list is stored as no field.
 */
export interface ExerciseAttributes {
	primaryMuscles?: MuscleGroup[];
	secondaryMuscles?: MuscleGroup[];
	movementPattern?: MovementPattern;
	category?: ExerciseCategory;
	equipment?: Equipment;
}

/**
 * How an exercise is performed, written by the lifter (ADR-0020): plain text
 * and a web link, each optional. Stored trimmed and never blank; the link is
 * an http or https URL. Not indexed, so adding them needs no schema version.
 */
export interface ExerciseInstructions {
	instructions?: string;
	instructionsUrl?: string;
}

/** A movement in the library, such as "Bench Press (Barbell)". */
export interface Exercise extends ExerciseAttributes, ExerciseInstructions {
	id: string;
	name: string;
	/**
	 * `name` normalised for matching (see normalizeExerciseName); unique, so
	 * two exercises cannot differ only by case or spacing.
	 */
	nameKey: string;
	/** Set when hidden from the library because history refers to it. */
	archivedAt?: number;
	/**
	 * Rest after a set of this exercise, in seconds, overriding the default
	 * rest in Settings. Not indexed, so adding it needs no schema version.
	 */
	restSeconds?: number;
	/**
	 * What its sets record; missing means "weight-reps", so exercises stored
	 * before measures existed need no migration. Not indexed (ADR-0012).
	 */
	measure?: SetMeasure;
}

/**
 * Where a template sits in a training program (ADR-0018): which program, which
 * block of it and which week of the block. Set on templates a program import
 * creates (#76) and copied onto workouts started from them. Not indexed.
 */
export interface ProgramLink {
	/** The program's own id, from the program file; stable across blocks. */
	programId: string;
	/** The program's name when the template was made. */
	programName: string;
	/** The block (mesocycle), from 1. */
	block: number;
	/** The week within the block, from 1. */
	week: number;
	/** The day within the week, such as "A"; absent when there is one day. */
	day?: string;
	/** Planned as a deload week (ADR-0013). Only `true` is stored. */
	deload?: boolean;
}

/**
 * The template a workout was started from (ADR-0018), as it was then: a
 * snapshot, so editing or deleting the template never changes the workout's
 * history. Not indexed.
 */
export interface WorkoutSource {
	templateId: string;
	templateName: string;
	program?: ProgramLink;
}

/** One training session. It is active (in progress) until endedAt is set. */
export interface Workout {
	id: string;
	name: string;
	startedAt: number;
	endedAt?: number;
	notes?: string;
	/** Set when started from a template (ADR-0018); absent otherwise. */
	source?: WorkoutSource;
}

/** An exercise as performed in one workout, in the workout's order. */
export interface WorkoutExercise {
	id: string;
	workoutId: string;
	exerciseId: string;
	/** Position within the workout, starting at 0. */
	order: number;
	/**
	 * Notes copied from the template exercise it was started from (ADR-0014),
	 * e.g. "seat 4, pause at the bottom". Not indexed.
	 */
	notes?: string;
}

/**
 * What a planned set aims for (ADR-0014): a rep range and the reps to leave
 * in reserve. Planned in a template and copied into the workout's sets, so
 * the last workout's sets say what they aimed for without a template link.
 * Whole numbers: repMin and repMax 1 to MAX_PLANNED_REPS, targetRir 0 to MAX_PLANNED_RIR; both
 * ends of the range or neither, and repMin is not above repMax. Not indexed.
 */
export interface PlannedTargets {
	repMin?: number;
	repMax?: number;
	/** Reps in reserve aimed for. */
	targetRir?: number;
}

/** The largest planned rep count (range end), and the largest target RIR. */
export const MAX_PLANNED_REPS = 999;
export const MAX_PLANNED_RIR = 99;

/** The planned target fields, in the order they are copied. */
export const PLANNED_TARGET_FIELDS = [
	"repMin",
	"repMax",
	"targetRir",
] as const satisfies readonly (keyof PlannedTargets)[];

/** One set of a workout exercise. Every measurement is optional. */
export interface WorkoutSet extends PlannedTargets {
	id: string;
	workoutExerciseId: string;
	/** Position within the workout exercise, starting at 0. */
	order: number;
	weightKg?: number;
	reps?: number;
	distanceM?: number;
	seconds?: number;
	rpe?: number;
	notes?: string;
	/**
	 * Marked by hand as a warm-up (#65): it does not count towards Volume,
	 * Estimated 1RM, records or progression. Only `true` is stored; a working
	 * set has no field. Not indexed (ADR-0012).
	 */
	warmup?: boolean;
	/** Set when the set is marked done; incomplete sets have none. */
	completedAt?: number;
}

/** A planned set in a template; the exercise's measure says which fields apply. */
export interface TemplateSet extends PlannedTargets {
	weightKg?: number;
	reps?: number;
	seconds?: number;
	distanceM?: number;
	/** A planned warm-up (#65), copied onto the set when a workout starts. */
	warmup?: boolean;
}

/** An exercise in a template; array position is its order. */
export interface TemplateExercise {
	exerciseId: string;
	sets: TemplateSet[];
	/** Cues shown while logging it, e.g. "seat 4"; never blank (ADR-0014). */
	notes?: string;
}

/**
 * A reusable workout plan. Edited and read as a whole, so its exercises and
 * sets are kept inside the record rather than in stores of their own.
 */
export interface Template {
	id: string;
	name: string;
	exercises: TemplateExercise[];
	/**
	 * The program, block and week this template plans (ADR-0018), set by a
	 * program import (#76). Kept when the template is edited. Not indexed.
	 */
	program?: ProgramLink;
}

/**
 * One day of the body log (ADR-0015): body weight and waist measured that
 * day. At most one entry per day; each measurement is optional, but an entry
 * holds at least one.
 */
export interface BodyEntry {
	id: string;
	/**
	 * The local calendar day measured, "YYYY-MM-DD" (unique). A day, not a
	 * time: it stays the same day when the phone changes time zone.
	 */
	date: string;
	/** Body weight in kilograms, unrounded, like every stored weight. */
	bodyWeightKg?: number;
	/** Waist circumference in centimetres. */
	waistCm?: number;
}

export type WeightUnit = "kg" | "lb";

/** User preferences, stored as a single record. */
export interface Settings {
	/** Unit for display and input; storage is always kg. */
	weightUnit: WeightUnit;
	/** Default rest after a set, in seconds; an exercise may override it. */
	restSeconds: number;
	/**
	 * When a backup file was last saved (epoch ms); unset until the first.
	 * Not indexed, so adding it needs no schema version.
	 */
	lastBackupAt?: number;
}

/**
 * Program file (ADR-0019): a multi-week plan written outside the app and
 * imported as templates.
 */

/** A planned set: the same fields as a template's planned set. */
export type ProgramSet = TemplateSet;

export interface ProgramExercise {
	/** Matched to the library ignoring case and spacing, or created. */
	name: string;
	/** For an exercise the library does not have yet; default weight-reps. */
	measure?: SetMeasure;
	/** Cues shown while logging, copied to the template exercise. */
	notes?: string;
	sets: ProgramSet[];
}

export interface ProgramDay {
	/** A short id unique within the week, such as "A". */
	day: string;
	/** What the day trains, such as "Lower"; used in the template name. */
	name?: string;
	exercises: ProgramExercise[];
}

export interface ProgramWeek {
	/** The week within the block, from 1. */
	week: number;
	/** A planned deload week (ADR-0013). */
	deload?: boolean;
	days: ProgramDay[];
}

export interface ProgramBlock {
	/** The block (mesocycle), from 1. */
	block: number;
	weeks: ProgramWeek[];
}

/** A program file as read: checked, values as written. */
export interface ProgramFile {
	format: typeof PROGRAM_FORMAT;
	formatVersion: number;
	/** Stable across the blocks of one program, such as "upper-lower-2026". */
	programId: string;
	name: string;
	blocks: ProgramBlock[];
}

export type ProgramParseResult =
	| { ok: true; program: ProgramFile }
	| { ok: false; errors: string[] };

/** An untrusted JSON object, before it is checked. */
export type JsonObject = Record<string, unknown>;

/** The measure each exercise name is given in the file, with where it was. */
export type ProgramMeasures = Map<
	string,
	{ measure: SetMeasure; path: string }
>;

/** An exercise the import creates, with the measure the file gives it. */
export interface NewProgramExercise {
	name: string;
	measure: SetMeasure;
}

/** An exercise the library has with another measure than the file says. */
export interface MeasureMismatch {
	name: string;
	fileMeasure: SetMeasure;
	libraryMeasure: SetMeasure;
}

/** A template the import would add, before ids are given. */
export interface PlannedProgramTemplate {
	name: string;
	program: ProgramLink;
	exercises: { nameKey: string; notes?: string; sets: TemplateSet[] }[];
}

export interface ProgramImportPlan {
	programId: string;
	programName: string;
	/** The blocks in the file, in file order. */
	blocks: number[];
	templates: PlannedProgramTemplate[];
	newExercises: NewProgramExercise[];
	/** How many of the file's exercises the library already has. */
	matchedExerciseCount: number;
	/** Library exercises whose measure differs; the library's is kept. */
	measureMismatches: MeasureMismatch[];
	/**
	 * Planned set fields the exercise's measure (the library's, or the file's
	 * or default for a new exercise) does not use, each with its JSON path.
	 * The import refuses while any is listed: they would vanish silently.
	 */
	setErrors: string[];
	/**
	 * Blocks of this program already imported (templates carry them). The
	 * import refuses while any is listed.
	 */
	alreadyImportedBlocks: number[];
}

export type ProgramImportResult =
	| { ok: true; templatesCreated: number; exercisesCreated: number }
	| { ok: false; reason: "already-imported"; blocks: number[] }
	| { ok: false; reason: "invalid-sets"; errors: string[] };
