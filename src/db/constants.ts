import type {
	Equipment,
	ExerciseCategory,
	MeasureField,
	MovementPattern,
	MuscleGroup,
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
