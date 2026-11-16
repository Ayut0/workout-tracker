import type { TemplateFromWorkoutResult } from "../db/templates";
import type { SetMeasure, TemplateExercise, TemplateSet } from "../db/types";
import { moveItem, planNextTemplateSet } from "../db/workoutLog";

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
 * Adds a planned set at the end of an exercise, starting with the
 * measurements of the set before it that the exercise's measure shows, as
 * logging a workout does.
 */
export function appendPlannedSet(
	exercises: readonly TemplateExercise[],
	exerciseIndex: number,
	measure: SetMeasure,
): TemplateExercise[] {
	return updateExerciseSets(exercises, exerciseIndex, (sets) => [
		...sets,
		planNextTemplateSet(sets.at(-1), measure),
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

const PLANNED_SET_FIELDS = [
	"weightKg",
	"reps",
	"seconds",
	"distanceM",
	"warmup",
	"repMin",
	"repMax",
	"targetRir",
] as const satisfies readonly (keyof TemplateSet)[];

/**
 * Changes a planned set's weight, reps, seconds, distance or warm-up mark, or
 * its targets (rep range and RIR, ADR-0014). Keys present with `undefined`
 * are cleared.
 */
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
			for (const field of PLANNED_SET_FIELDS) {
				if (!(field in changes)) continue;
				const value = changes[field];
				if (value === undefined) delete next[field];
				else Object.assign(next, { [field]: value });
			}
			return next;
		}),
	);
}

/**
 * Sets an exercise's notes (ADR-0014), shown under it while logging. Text
 * that is empty clears them; anything else, whitespace-only included, is kept
 * as typed so no keystroke is lost, and `tidyNotes` trims it, and drops
 * blanks, when the template is saved.
 */
export function setTemplateExerciseNotes(
	exercises: readonly TemplateExercise[],
	exerciseIndex: number,
	notes: string,
): TemplateExercise[] {
	return exercises.map((exercise, i) => {
		if (i !== exerciseIndex) return exercise;
		const { notes: _old, ...rest } = exercise;
		return notes === "" ? rest : { ...rest, notes };
	});
}

/** Rows for a notes field: one per line (a trailing line break opens one), at least two. */
export function templateNotesRows(notes: string | undefined): number {
	return Math.max(2, (notes ?? "").split("\n").length);
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
			? { ...exercise, sets: update(exercise.sets) }
			: exercise,
	);
}
