import type { ReactNode } from "react";
import type { SetMeasure, WeightUnit, WorkoutSet } from "../../db/types";
import { canPlanTargets, type SetChanges } from "../../db/workoutLog";
import { MeasureInputs } from "./MeasureInputs";
import { RpeChips } from "./RpeChips";
import { SetTargets } from "./SetTargets";
import { WarmupToggle } from "./WarmupToggle";

type SetRowProps = {
	set: WorkoutSet;
	/** 1-based, as shown. */
	number: number;
	exerciseName: string;
	/** What the exercise's sets record; picks the inputs shown (ADR-0012). */
	measure: SetMeasure;
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

/**
 * One set: the inputs for the exercise's measure and a done toggle, with the
 * warm-up toggle (#65) and the RPE chip row (#64) beneath. Edits are saved as
 * typed.
 */
export function SetRow({
	set,
	number,
	exerciseName,
	measure,
	weightUnit,
	previous,
	onChange,
	onToggleDone,
	onRemove,
}: SetRowProps) {
	const done = set.completedAt !== undefined;
	const label = `${exerciseName} set ${number}`;
	const className = ["set-row", done && "done", set.warmup && "warmup"]
		.filter(Boolean)
		.join(" ");

	return (
		<li className={className}>
			<span className="set-number">{number}</span>
			{previous !== undefined && (
				<span className="set-previous">{previous}</span>
			)}
			<MeasureInputs
				measure={measure}
				values={set}
				label={label}
				weightUnit={weightUnit}
				onChange={onChange}
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
			{canPlanTargets(measure) && <SetTargets targets={set} />}
			<div className="set-extras">
				<WarmupToggle
					warmup={set.warmup}
					label={label}
					onChange={(warmup) => onChange({ warmup })}
				/>
				<RpeChips
					rpe={set.rpe}
					label={label}
					onToggle={(tapped) => onChange({ toggleRpe: tapped })}
				/>
			</div>
		</li>
	);
}
