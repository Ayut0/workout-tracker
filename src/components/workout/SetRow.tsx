import type { ReactNode } from "react";
import type { WeightUnit, WorkoutSet } from "../../db/types";
import type { SetChanges } from "../../db/workoutLog";
import { useDraftField } from "../../hooks/useDraftField";
import { formatWeightValue } from "../../lib/units";
import { readRepsField, readWeightField } from "../../lib/workoutLog";

type SetRowProps = {
	set: WorkoutSet;
	/** 1-based, as shown. */
	number: number;
	exerciseName: string;
	weightUnit: WeightUnit;
	/**
	 * The Previous column's cell (#28): what this set did last time.
	 * Undefined leaves the column out.
	 */
	previous?: ReactNode;
	onChange: (changes: SetChanges) => void;
	onToggleDone: () => void;
	onRemove: () => void;
};

/** One set: weight, reps and a done toggle. Edits are saved as typed. */
export function SetRow({
	set,
	number,
	exerciseName,
	weightUnit,
	previous,
	onChange,
	onToggleDone,
	onRemove,
}: SetRowProps) {
	const done = set.completedAt !== undefined;
	const label = `${exerciseName} set ${number}`;
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
		<li className={done ? "set-row done" : "set-row"}>
			<span className="set-number">{number}</span>
			{previous !== undefined && (
				<span className="set-previous">{previous}</span>
			)}
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
				className="set-done"
				aria-pressed={done}
				aria-label={`${label} done`}
				onClick={onToggleDone}
			>
				✓
			</button>
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
