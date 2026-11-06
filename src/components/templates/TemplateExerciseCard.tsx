import type { TemplateExercise, TemplateSet, WeightUnit } from "../../db/types";
import { useDraftField } from "../../hooks/useDraftField";
import type { PlannedSetChanges } from "../../lib/templates";
import { formatWeightValue } from "../../lib/units";
import { readRepsField, readWeightField } from "../../lib/workoutLog";

type TemplateExerciseCardProps = {
	exercise: TemplateExercise;
	name: string;
	/** Position in the template, from 0, and how many exercises it has. */
	index: number;
	count: number;
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
	weightUnit,
	onMove,
	onRemove,
	onAddSet,
	onSetChange,
	onRemoveSet,
}: TemplateExerciseCardProps) {
	const headingId = `template-exercise-${index}`;
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
			<div className="set-grid planned">
				<div className="set-head" aria-hidden="true">
					<span>Set</span>
					<span>{weightUnit}</span>
					<span>Reps</span>
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
	weightUnit: WeightUnit;
	onChange: (changes: PlannedSetChanges) => void;
	onRemove: () => void;
};

/** One planned set: optional weight (in the user's unit) and reps. */
function PlannedSetRow({
	set,
	label,
	number,
	weightUnit,
	onChange,
	onRemove,
}: PlannedSetRowProps) {
	const weight = useDraftField(
		set.weightKg === undefined
			? ""
			: formatWeightValue(set.weightKg, weightUnit),
		(text) => {
			const input = readWeightField(text, weightUnit);
			if (input.ok) onChange({ weightKg: input.value });
		},
	);
	const reps = useDraftField(
		set.reps === undefined ? "" : String(set.reps),
		(text) => {
			const input = readRepsField(text);
			if (input.ok) onChange({ reps: input.value });
		},
	);
	return (
		<li className="set-row">
			<span className="set-number">{number}</span>
			<input
				className="set-input"
				type="text"
				inputMode="decimal"
				enterKeyHint="next"
				autoComplete="off"
				placeholder="–"
				aria-label={`${label} weight (${weightUnit})`}
				{...weight}
			/>
			<input
				className="set-input"
				type="text"
				inputMode="numeric"
				pattern="[0-9]*"
				enterKeyHint="done"
				autoComplete="off"
				placeholder="–"
				aria-label={`${label} reps`}
				{...reps}
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
