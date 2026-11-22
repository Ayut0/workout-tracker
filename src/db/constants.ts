import type {
	Equipment,
	ExerciseCategory,
	MeasureField,
	MovementPattern,
	MuscleGroup,
	PlannedTargets,
	ProgramBlock,
	ProgramDay,
	ProgramExercise,
	ProgramFile,
	ProgramSet,
	ProgramWeek,
	SetMeasure,
} from "./types";

/** Every measure, in the order the library offers them. */
export const SET_MEASURES = [
	"weight-reps",
	"reps",
	"seconds",
	"distance",
] as const satisfies readonly SetMeasure[];

/** The measure of an exercise that has none stored. */
export const DEFAULT_SET_MEASURE: SetMeasure = "weight-reps";

/** The set fields each measure shows, in column order. */
export const MEASURE_FIELDS: Record<SetMeasure, readonly MeasureField[]> = {
	"weight-reps": ["weightKg", "reps"],
	reps: ["reps"],
	seconds: ["seconds"],
	distance: ["distanceM"],
};

/**
 * Muscle groups an exercise trains (ADR-0016). The groups do not overlap, so
 * a set can be counted once per group: weekly sets per muscle group (#75)
 * count a primary muscle as one set and a secondary muscle as half.
 */
export const MUSCLE_GROUPS = [
	"chest",
	"lats",
	"upper-back",
	"lower-back",
	"front-delts",
	"side-delts",
	"rear-delts",
	"biceps",
	"triceps",
	"forearms",
	"abs",
	"glutes",
	"quads",
	"hamstrings",
	"adductors",
	"calves",
] as const satisfies readonly MuscleGroup[];

/** The movement pattern of an exercise (ADR-0016). */
export const MOVEMENT_PATTERNS = [
	"squat",
	"hinge",
	"lunge",
	"horizontal-push",
	"vertical-push",
	"horizontal-pull",
	"vertical-pull",
	"carry",
	"rotation",
	"isolation",
] as const satisfies readonly MovementPattern[];

/** What kind of training an exercise is (ADR-0016). */
export const EXERCISE_CATEGORIES = [
	"strength",
	"power",
	"agility",
	"mobility",
	"core",
] as const satisfies readonly ExerciseCategory[];

/** What an exercise is done with; decides the progression increment. */
export const EQUIPMENT = [
	"barbell",
	"dumbbell",
	"machine",
	"cable",
	"bodyweight",
	"other",
] as const satisfies readonly Equipment[];

/** The format name a program file declares (ADR-0019). */
export const PROGRAM_FORMAT = "workout-tracker-program";

/** The version of the program file format this app reads and documents. */
export const PROGRAM_FORMAT_VERSION = 1;

/** At most this many problems are listed; the rest are counted. */
export const MAX_PROGRAM_ERRORS = 20;

/**
 * What a program file may hold (ADR-0019). The file is untrusted, often
 * generated, and imported in bulk, so size, counts, lengths and numbers are
 * capped well above a real plan. Every cap reports its own error message.
 */
export const PROGRAM_LIMITS = {
	/** Checked before the file is read into memory. */
	maxFileBytes: 2 * 1024 * 1024,
	maxBlocks: 12,
	maxWeeksPerBlock: 12,
	maxDaysPerWeek: 7,
	/** Blocks × weeks × days: one template is created for each. */
	maxTemplates: 300,
	maxExercisesPerDay: 30,
	maxSetsPerExercise: 30,
	/** Program, day and exercise names. */
	maxNameLength: 100,
	/** programId and day ids. */
	maxIdLength: 40,
	maxNotesLength: 500,
	maxBlockNumber: 99,
	maxWeekNumber: 99,
	maxWeightKg: 1000,
	/** Reps, repMin and repMax. */
	maxReps: 999,
	/** 24 hours. */
	maxSeconds: 86_400,
	maxDistanceM: 100_000,
	maxTargetRir: 20,
} as const;

export const PROGRAM_KEYS = [
	"format",
	"formatVersion",
	"programId",
	"name",
	"blocks",
] as const satisfies readonly (keyof ProgramFile)[];
export const BLOCK_KEYS = [
	"block",
	"weeks",
] as const satisfies readonly (keyof ProgramBlock)[];
export const WEEK_KEYS = [
	"week",
	"deload",
	"days",
] as const satisfies readonly (keyof ProgramWeek)[];
export const DAY_KEYS = [
	"day",
	"name",
	"exercises",
] as const satisfies readonly (keyof ProgramDay)[];
export const EXERCISE_KEYS = [
	"name",
	"measure",
	"notes",
	"sets",
] as const satisfies readonly (keyof ProgramExercise)[];
export const TARGET_KEYS = [
	"repMin",
	"repMax",
	"targetRir",
] as const satisfies readonly (keyof PlannedTargets)[];
export const SET_KEYS = [
	"weightKg",
	"reps",
	"seconds",
	"distanceM",
	"warmup",
	...TARGET_KEYS,
] as const satisfies readonly (keyof ProgramSet)[];

/** Zero-width and soft-hyphen characters, which show as nothing. */
export const INVISIBLE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;

/** The set fields in the order problems are listed. */
export const SET_VALUE_FIELDS = [
	"weightKg",
	"reps",
	"seconds",
	"distanceM",
	...TARGET_KEYS,
] as const;
