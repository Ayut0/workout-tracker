import type { PlannedTargets } from "../../db/types";
import { useDraftField } from "../../hooks/useDraftField";
import {
	formatRepRange,
	formatRir,
	readRepRangeInput,
	readRirInput,
} from "../../lib/plannedTargets";

/** A change to a planned set's targets; `undefined` clears a field. */
type TargetChanges = { [K in keyof PlannedTargets]?: number | undefined };

type PlannedTargetInputsProps = {
	targets: PlannedTargets;
	/** Names the set, e.g. "Bench Press set 1". */
	label: string;
	onChange: (changes: TargetChanges) => void;
};

/**
 * A planned set's rep range and target RIR (ADR-0014), under its
 * measurements. The range takes "8" (exactly 8) or "6-8"; a value that does
 * not read is not saved and is marked invalid until the field loses focus.
 */
export function PlannedTargetInputs({
	targets,
	label,
	onChange,
}: PlannedTargetInputsProps) {
	const range = useDraftField(
		formatRepRange(targets.repMin, targets.repMax),
		(text) => {
			const read = readRepRangeInput(text);
			if (read.ok) onChange({ repMin: read.repMin, repMax: read.repMax });
		},
	);
	const rir = useDraftField(formatRir(targets.targetRir), (text) => {
		const read = readRirInput(text);
		if (read.ok) onChange({ targetRir: read.value });
	});
	return (
		<div className="set-targets">
			<label className="set-target-field">
				<span>Rep range</span>
				<input
					className="set-input"
					type="text"
					inputMode="text"
					enterKeyHint="next"
					autoComplete="off"
					placeholder="e.g. 6-8"
					aria-label={`${label} rep range`}
					aria-invalid={!readRepRangeInput(range.value).ok}
					{...range}
				/>
			</label>
			<label className="set-target-field">
				<span>RIR</span>
				<input
					className="set-input"
					type="text"
					inputMode="numeric"
					pattern="[0-9]*"
					enterKeyHint="done"
					autoComplete="off"
					placeholder="–"
					aria-label={`${label} target RIR`}
					aria-invalid={!readRirInput(rir.value).ok}
					{...rir}
				/>
			</label>
		</div>
	);
}
