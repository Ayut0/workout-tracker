import type { SetMeasure, WeightUnit, WorkoutSet } from "../db/types";
import type { SetUpdate } from "../db/workoutLog";
import type {
	IncrementExercise,
	ProgressionAction,
	ProgressionSet,
	SuggestedSet,
} from "./progression";

/** The parts of today's sets the suggestion reads. */
export type TodaySet = Pick<
	WorkoutSet,
	"id" | "weightKg" | "reps" | "warmup" | "repMin" | "repMax" | "completedAt"
>;

export interface SuggestionInput {
	/** Today's sets of the exercise, in order, warm-ups included. */
	sets: readonly TodaySet[];
	/**
	 * The last finished workout's complete sets of the exercise, in order,
	 * warm-ups included (`listPreviousSets`).
	 */
	previous: readonly ProgressionSet[];
	measure: SetMeasure;
	exercise: IncrementExercise;
	unit: WeightUnit;
}

/** One group's suggestion (e.g. the heavy sets, or the back-off sets). */
export interface ExerciseSuggestion {
	action: ProgressionAction;
	repMin: number;
	repMax: number;
	/** The suggested sets, one per working set the group did last time. */
	sets: SuggestedSet[];
	/**
	 * What "Use" writes: the suggested weight and reps for today's working
	 * sets of the same rep range that are not done yet and do not already
	 * show it (planned or typed values are overwritten). Never a
	 * warm-up. Empty once used, which hides the button.
	 */
	fills: SetUpdate[];
}
