import {
	MEASURE_FIELDS,
	type MeasureField,
	type SetMeasure,
	type WeightUnit,
} from "../../db/types";
import { useDraftField } from "../../hooks/useDraftField";
import {
	describeFieldInput,
	formatFieldInput,
	readFieldInput,
} from "../../lib/setMeasure";

/**
 * Values for the measure fields: what a set or planned set holds, or a typed
 * change, where `undefined` clears the field.
 */
type MeasureValues = { [F in MeasureField]?: number | undefined };

type MeasureInputsProps = {
	measure: SetMeasure;
	values: MeasureValues;
	/** Names the set, e.g. "Bench Press set 1". */
	label: string;
	weightUnit: WeightUnit;
	onChange: (changes: MeasureValues) => void;
};

/**
 * The inputs of a set row for its exercise's measure (ADR-0012): weight and
 * reps, reps, seconds or distance. Fields the measure does not show are left
 * as stored. Edits are saved as typed.
 */
export function MeasureInputs({
	measure,
	values,
	label,
	weightUnit,
	onChange,
}: MeasureInputsProps) {
	const fields = MEASURE_FIELDS[measure];
	return fields.map((field, i) => (
		<MeasureInput
			key={field}
			field={field}
			value={values[field]}
			label={label}
			weightUnit={weightUnit}
			last={i === fields.length - 1}
			onChange={onChange}
		/>
	));
}

type MeasureInputProps = {
	field: MeasureField;
	value: number | undefined;
	label: string;
	weightUnit: WeightUnit;
	/** The last input of the row: the keyboard's key says "done". */
	last: boolean;
	onChange: (changes: MeasureValues) => void;
};

function MeasureInput({
	field,
	value,
	label,
	weightUnit,
	last,
	onChange,
}: MeasureInputProps) {
	const input = useDraftField(
		formatFieldInput(field, value, weightUnit),
		(text) => {
			const read = readFieldInput(field, text, weightUnit);
			if (read.ok) onChange({ [field]: read.value });
		},
	);
	const whole = field === "reps" || field === "seconds";
	return (
		<input
			className="set-input"
			type="text"
			inputMode={whole ? "numeric" : "decimal"}
			pattern={field === "reps" ? "[0-9]*" : undefined}
			enterKeyHint={last ? "done" : "next"}
			autoComplete="off"
			placeholder="–"
			aria-label={`${label} ${describeFieldInput(field, weightUnit)}`}
			{...input}
		/>
	);
}
