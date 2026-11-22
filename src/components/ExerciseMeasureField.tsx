import type { ChangeEvent } from "react";
import { SET_MEASURES } from "../db/constants";
import type { SetMeasure } from "../db/types";
import { describeMeasure, isSetMeasure } from "../lib/setMeasure";

type ExerciseMeasureFieldProps = {
	/** What the exercise's sets record. */
	measure: SetMeasure;
	onChange: (measure: SetMeasure) => void;
	/** Shown under the field. */
	hint?: string;
};

/** Chooses what an exercise's sets record (ADR-0012). */
export function ExerciseMeasureField({
	measure,
	onChange,
	hint,
}: ExerciseMeasureFieldProps) {
	function handleChange(event: ChangeEvent<HTMLSelectElement>) {
		const { value } = event.target;
		if (isSetMeasure(value)) onChange(value);
	}

	return (
		<label className="field">
			<span className="label">Log sets by</span>
			<select value={measure} onChange={handleChange}>
				{SET_MEASURES.map((option) => (
					<option key={option} value={option}>
						{describeMeasure(option)}
					</option>
				))}
			</select>
			{hint !== undefined && <span className="hint">{hint}</span>}
		</label>
	);
}
