import { tidyNotes } from "../../db/workoutLog";

type ExerciseNotesProps = {
	notes: string | undefined;
};

/**
 * The notes a workout exercise was copied with from its template (ADR-0014),
 * shown read-only under its name. Nothing when it has none, or only blanks.
 */
export function ExerciseNotes({ notes }: ExerciseNotesProps) {
	if (tidyNotes(notes) === undefined) return null;
	return <p className="exercise-notes">{notes}</p>;
}
