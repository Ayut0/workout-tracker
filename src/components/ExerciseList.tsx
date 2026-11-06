import type { ReactNode } from "react";
import type { Exercise } from "../db/types";

type ExerciseListProps = {
	exercises: Exercise[];
	onSelect: (exercise: Exercise) => void;
	/** Shown when there are no exercises. */
	empty: ReactNode;
	/** The exercise whose detail is open below its row, if any. */
	expandedId?: string | null;
	renderExpanded?: (exercise: Exercise) => ReactNode;
};

/** A tappable list of exercises; reusable as a picker. */
export function ExerciseList({
	exercises,
	onSelect,
	empty,
	expandedId = null,
	renderExpanded,
}: ExerciseListProps) {
	if (exercises.length === 0) return <p className="empty">{empty}</p>;
	return (
		<ul className="exercise-list">
			{exercises.map((exercise) => {
				const expanded = exercise.id === expandedId;
				return (
					<li key={exercise.id}>
						<button
							type="button"
							className="exercise-row"
							aria-expanded={renderExpanded ? expanded : undefined}
							onClick={() => onSelect(exercise)}
						>
							{exercise.name}
						</button>
						{expanded && renderExpanded?.(exercise)}
					</li>
				);
			})}
		</ul>
	);
}
