import { SET_MEASURES, type SetMeasure } from "../db/types";
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
	return (
		<label className="field">
			<span className="label">Log sets by</span>
			<select
				value={measure}
				onChange={(e) => {
					if (isSetMeasure(e.target.value)) onChange(e.target.value);
				}}
			>
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
