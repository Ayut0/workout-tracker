import type { ReactNode } from "react";
import type { WorkoutExerciseDetail } from "../../db";
import { MEASURE_FIELDS } from "../../db/constants";
import type { SetMeasure, WeightUnit, WorkoutSet } from "../../db/types";
import type { SetChanges } from "../../db/workoutLog";
import { describeFieldColumn } from "../../lib/setMeasure";
import { ExerciseNotes } from "./ExerciseNotes";
import { SetRow } from "./SetRow";

type ExerciseCardProps = {
	entry: WorkoutExerciseDetail;
	name: string;
	/** Position in the workout, from 0, and how many exercises it has. */
	index: number;
	count: number;
	/** What the exercise's sets record; picks the set columns (ADR-0012). */
	measure: SetMeasure;
	weightUnit: WeightUnit;
	/**
	 * The Previous column (#28): what the set at this position did the last
	 * time this exercise was logged, given today's set to fill. Without it the
	 * column is not shown.
	 */
	renderPrevious?:
		| ((setIndex: number, set: WorkoutSet) => ReactNode)
		| undefined;
	/** What Progression suggests (#71), shown under the notes; optional. */
	suggestions?: ReactNode;
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
	measure,
	weightUnit,
	renderPrevious,
	suggestions,
	onMove,
	onRemove,
	onAddSet,
	onSetChange,
	onToggleSetDone,
	onRemoveSet,
}: ExerciseCardProps) {
	const headingId = `exercise-${entry.workoutExercise.id}`;
	const withPrevious = renderPrevious !== undefined;
	const fields = MEASURE_FIELDS[measure];
	const gridClass = [
		"set-grid",
		withPrevious && "with-previous",
		fields.length === 1 && "single-measure",
	]
		.filter(Boolean)
		.join(" ");
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
			<ExerciseNotes notes={entry.workoutExercise.notes} />
			{suggestions}
			<div className={gridClass}>
				<div className="set-head" aria-hidden="true">
					<span>Set</span>
					{withPrevious && <span>Previous</span>}
					{fields.map((field) => (
						<span key={field}>{describeFieldColumn(field, weightUnit)}</span>
					))}
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
							measure={measure}
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
