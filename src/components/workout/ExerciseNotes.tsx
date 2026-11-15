type ExerciseNotesProps = {
	notes: string | undefined;
};

/**
 * The notes a workout exercise was copied with from its template (ADR-0014),
 * shown read-only under its name. Nothing when it has none.
 */
export function ExerciseNotes({ notes }: ExerciseNotesProps) {
	if (notes === undefined) return null;
	return <p className="exercise-notes">{notes}</p>;
}
