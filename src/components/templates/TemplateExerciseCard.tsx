import {
	MEASURE_FIELDS,
	type SetMeasure,
	type TemplateExercise,
	type TemplateSet,
	type WeightUnit,
} from "../../db/types";
import { describeFieldColumn } from "../../lib/setMeasure";
import type { PlannedSetChanges } from "../../lib/templates";
import { MeasureInputs } from "../workout/MeasureInputs";

type TemplateExerciseCardProps = {
	exercise: TemplateExercise;
	name: string;
	/** Position in the template, from 0, and how many exercises it has. */
	index: number;
	count: number;
	/** What the exercise's sets record; picks the planned set columns (ADR-0012). */
	measure: SetMeasure;
	weightUnit: WeightUnit;
	onMove: (toIndex: number) => void;
	onRemove: () => void;
	onAddSet: () => void;
	onSetChange: (setIndex: number, changes: PlannedSetChanges) => void;
	onRemoveSet: (setIndex: number) => void;
};

/** One exercise in a template: its planned sets, and buttons to reorder or remove it. */
export function TemplateExerciseCard({
	exercise,
	name,
	index,
	count,
	measure,
	weightUnit,
	onMove,
	onRemove,
	onAddSet,
	onSetChange,
	onRemoveSet,
}: TemplateExerciseCardProps) {
	const headingId = `template-exercise-${index}`;
	const fields = MEASURE_FIELDS[measure];
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
			<div
				className={
					fields.length === 1
						? "set-grid planned single-measure"
						: "set-grid planned"
				}
			>
				<div className="set-head" aria-hidden="true">
					<span>Set</span>
					{fields.map((field) => (
						<span key={field}>{describeFieldColumn(field, weightUnit)}</span>
					))}
					<span />
				</div>
				<ol className="set-list">
					{exercise.sets.map((set, setIndex) => (
						<PlannedSetRow
							// Planned sets have no id; a row's draft only lives while it
							// has focus, and tapping elsewhere ends that.
							// biome-ignore lint/suspicious/noArrayIndexKey: see above
							key={setIndex}
							set={set}
							label={`${name} set ${setIndex + 1}`}
							number={setIndex + 1}
							measure={measure}
							weightUnit={weightUnit}
							onChange={(changes) => onSetChange(setIndex, changes)}
							onRemove={() => onRemoveSet(setIndex)}
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

type PlannedSetRowProps = {
	set: TemplateSet;
	label: string;
	number: number;
	measure: SetMeasure;
	weightUnit: WeightUnit;
	onChange: (changes: PlannedSetChanges) => void;
	onRemove: () => void;
};

/** One planned set: the inputs for the exercise's measure (weight in the user's unit). */
function PlannedSetRow({
	set,
	label,
	number,
	measure,
	weightUnit,
	onChange,
	onRemove,
}: PlannedSetRowProps) {
	return (
		<li className="set-row">
			<span className="set-number">{number}</span>
			<MeasureInputs
				measure={measure}
				values={set}
				label={label}
				weightUnit={weightUnit}
				onChange={onChange}
			/>
			<button
				type="button"
				className="set-remove"
				aria-label={`Remove ${label}`}
				onClick={onRemove}
			>
				×
			</button>
		</li>
	);
}
