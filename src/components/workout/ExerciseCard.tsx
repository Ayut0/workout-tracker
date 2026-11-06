import type { ReactNode } from "react";
import type { WorkoutExerciseDetail } from "../../db";
import type { WeightUnit, WorkoutSet } from "../../db/types";
import type { SetChanges } from "../../db/workoutLog";
import { SetRow } from "./SetRow";

type ExerciseCardProps = {
	entry: WorkoutExerciseDetail;
	name: string;
	/** Position in the workout, from 0, and how many exercises it has. */
	index: number;
	count: number;
	weightUnit: WeightUnit;
	/**
	 * The Previous column (#28): what the set at this position did the last
	 * time this exercise was logged, given today's set to fill. Without it the
	 * column is not shown.
	 */
	renderPrevious?:
		| ((setIndex: number, set: WorkoutSet) => ReactNode)
		| undefined;
	onMove: (toIndex: number) => void;
	onRemove: () => void;
	onAddSet: () => void;
	onSetChange: (setId: string, changes: SetChanges) => void;
	onToggleSetDone: (set: WorkoutSet) => void;
	onRemoveSet: (setId: string) => void;
};

/** One exercise in the active workout: its sets, and buttons to reorder or remove it. */
export function ExerciseCard({
	entry,
	name,
	index,
	count,
	weightUnit,
	renderPrevious,
	onMove,
	onRemove,
	onAddSet,
	onSetChange,
	onToggleSetDone,
	onRemoveSet,
}: ExerciseCardProps) {
	const headingId = `exercise-${entry.workoutExercise.id}`;
	const withPrevious = renderPrevious !== undefined;
	return (
		<section className="exercise-card" aria-labelledby={headingId}>
			<div className="exercise-card-head">
				<h2 id={headingId}>{name}</h2>
				<div className="exercise-card-tools">
					<button
						type="button"
						className="icon-button"
						aria-label={`Move ${name} up`}
						disabled={index === 0}
						onClick={() => onMove(index - 1)}
					>
						↑
					</button>
					<button
						type="button"
						className="icon-button"
						aria-label={`Move ${name} down`}
						disabled={index === count - 1}
						onClick={() => onMove(index + 1)}
					>
						↓
					</button>
					<button
						type="button"
						className="icon-button danger-text"
						aria-label={`Remove ${name}`}
						onClick={onRemove}
					>
						×
					</button>
				</div>
			</div>
			<div className={withPrevious ? "set-grid with-previous" : "set-grid"}>
				<div className="set-head" aria-hidden="true">
					<span>Set</span>
					{withPrevious && <span>Previous</span>}
					<span>{weightUnit}</span>
					<span>Reps</span>
					<span>Done</span>
					<span />
				</div>
				<ol className="set-list">
					{entry.sets.map((set, setIndex) => (
						<SetRow
							key={set.id}
							set={set}
							number={setIndex + 1}
							exerciseName={name}
							weightUnit={weightUnit}
							previous={
								renderPrevious
									? (renderPrevious(setIndex, set) ?? "–")
									: undefined
							}
							onChange={(changes) => onSetChange(set.id, changes)}
							onToggleDone={() => onToggleSetDone(set)}
							onRemove={() => onRemoveSet(set.id)}
						/>
					))}
				</ol>
			</div>
			<button type="button" className="secondary add-set" onClick={onAddSet}>
				Add set
			</button>
		</section>
	);
}
