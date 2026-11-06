import type { TemplateFromWorkoutResult } from "../db/templates";
import type { TemplateExercise, TemplateSet } from "../db/types";
import { moveItem, planNextSet } from "../db/workoutLog";

/**
 * Pure edits to a template's planned exercises while the editor holds them
 * as a draft; the template editor saves the result with updateTemplate.
 * Each returns a new array and leaves its input unchanged.
 */

/** Adds an exercise at the end with one empty planned set. */
export function appendTemplateExercise(
	exercises: readonly TemplateExercise[],
	exerciseId: string,
): TemplateExercise[] {
	return [...exercises, { exerciseId, sets: [{}] }];
}

/** Removes the exercise at `index`; an unknown index changes nothing. */
export function removeTemplateExercise(
	exercises: readonly TemplateExercise[],
	index: number,
): TemplateExercise[] {
	return exercises.filter((_, i) => i !== index);
}

/** Moves the exercise at `from` to `to` (clamped to the ends). */
export function moveTemplateExercise(
	exercises: readonly TemplateExercise[],
	from: number,
	to: number,
): TemplateExercise[] {
	return moveItem(exercises, from, to);
}

/**
 * Adds a planned set at the end of an exercise, starting with the weight and
 * reps of the set before it, as logging a workout does.
 */
export function appendPlannedSet(
	exercises: readonly TemplateExercise[],
	exerciseIndex: number,
): TemplateExercise[] {
	return updateExerciseSets(exercises, exerciseIndex, (sets) => [
		...sets,
		planNextSet(sets.at(-1)),
	]);
}

/** Removes a planned set; the sets after it close up. */
export function removePlannedSet(
	exercises: readonly TemplateExercise[],
	exerciseIndex: number,
	setIndex: number,
): TemplateExercise[] {
	return updateExerciseSets(exercises, exerciseIndex, (sets) =>
		sets.filter((_, i) => i !== setIndex),
	);
}

/** The planned set fields a user edits; `undefined` clears a field. */
export type PlannedSetChanges = {
	[K in keyof TemplateSet]?: TemplateSet[K] | undefined;
};

/** Changes a planned set's weight or reps. Keys present with `undefined` are cleared. */
export function updatePlannedSet(
	exercises: readonly TemplateExercise[],
	exerciseIndex: number,
	setIndex: number,
	changes: PlannedSetChanges,
): TemplateExercise[] {
	return updateExerciseSets(exercises, exerciseIndex, (sets) =>
		sets.map((set, i) => {
			if (i !== setIndex) return set;
			const next: TemplateSet = { ...set };
			if ("weightKg" in changes) {
				if (changes.weightKg === undefined) delete next.weightKg;
				else next.weightKg = changes.weightKg;
			}
			if ("reps" in changes) {
				if (changes.reps === undefined) delete next.reps;
				else next.reps = changes.reps;
			}
			return next;
		}),
	);
}

/** What to tell the user after saving a workout as a template. */
export function describeTemplateFromWorkout(
	result: TemplateFromWorkoutResult,
): string {
	if (result.ok) return `Saved template “${result.template.name}”.`;
	if (result.reason === "no-complete-sets") {
		return "Nothing to save as a template: no set was marked done.";
	}
	return "That workout no longer exists.";
}

/** Counts a template's planned sets across all its exercises. */
export function countPlannedSets(
	exercises: readonly TemplateExercise[],
): number {
	return exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

function updateExerciseSets(
	exercises: readonly TemplateExercise[],
	exerciseIndex: number,
	update: (sets: readonly TemplateSet[]) => TemplateSet[],
): TemplateExercise[] {
	return exercises.map((exercise, i) =>
		i === exerciseIndex
			? { exerciseId: exercise.exerciseId, sets: update(exercise.sets) }
			: exercise,
	);
}
