import { type ExerciseNameResult, normalizeExerciseName } from "../db";
import type { Exercise } from "../db/types";

/**
 * Exercises whose name contains the query, ignoring case and spacing. A blank
 * query matches everything. Keeps the input order.
 */
export function filterExercisesByName(
	exercises: Exercise[],
	query: string,
): Exercise[] {
	const key = normalizeExerciseName(query);
	if (key === "") return exercises;
	return exercises.filter((exercise) => exercise.nameKey.includes(key));
}

type ExerciseNameError = Extract<ExerciseNameResult, { ok: false }>;

/** A message for the user explaining why a name was rejected. */
export function describeExerciseNameError(error: ExerciseNameError): string {
	switch (error.reason) {
		case "empty":
			return "Enter a name.";
		case "duplicate":
			return error.existing.archivedAt === undefined
				? `“${error.existing.name}” is already in your library.`
				: `“${error.existing.name}” is archived. Restore it instead.`;
		case "not-found":
			return "That exercise no longer exists.";
	}
}
