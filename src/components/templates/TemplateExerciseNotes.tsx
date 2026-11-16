import { useId } from "react";
import { templateNotesRows } from "../../lib/templates";

type TemplateExerciseNotesProps = {
	/** The exercise's name, to label the field. */
	name: string;
	notes: string | undefined;
	/** Emits the text as typed; only empty text clears the notes. */
	onChange: (notes: string) => void;
};

/**
 * A template exercise's notes (ADR-0014): cues such as "seat 4" or "pause at
 * the bottom", shown under the exercise while logging a workout started from
 * the template.
 */
export function TemplateExerciseNotes({
	name,
	notes,
	onChange,
}: TemplateExerciseNotesProps) {
	const id = useId();
	return (
		<div className="exercise-notes-field">
			<label htmlFor={id} className="visually-hidden">
				{`${name} notes`}
			</label>
			<textarea
				id={id}
				className="text-input notes-input"
				rows={templateNotesRows(notes)}
				autoCapitalize="sentences"
				placeholder="Notes, e.g. seat 4, pause at the bottom"
				value={notes ?? ""}
				onChange={(e) => onChange(e.target.value)}
			/>
		</div>
	);
}
