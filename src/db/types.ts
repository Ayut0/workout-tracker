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

/** A movement in the library, such as "Bench Press (Barbell)". */
export interface Exercise extends ExerciseAttributes {
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

/** One training session. It is active (in progress) until endedAt is set. */
export interface Workout {
	id: string;
	name: string;
	startedAt: number;
	endedAt?: number;
	notes?: string;
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

/** One set of a workout exercise. Every measurement is optional. */
export interface WorkoutSet {
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
export interface TemplateSet {
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
