import { describeRpeChips, toggleRpe } from "../../lib/rpe";

type RpeChipsProps = {
	rpe: number | undefined;
	/** Names the set, e.g. "Bench Press set 1". */
	label: string;
	/** The new RPE; undefined clears it. */
	onChange: (rpe: number | undefined) => void;
};

/**
 * The RPE chip row of a set (#64): 6 to 10, one tap sets, tapping the
 * selected chip clears. An RPE no chip stands for (an imported 8.5) is shown
 * before the chips until a tap replaces it.
 */
export function RpeChips({ rpe, label, onChange }: RpeChipsProps) {
	const { chips, other } = describeRpeChips(rpe);
	return (
		<fieldset className="rpe-chips">
			<legend className="rpe-legend">RPE</legend>
			{other !== undefined && (
				<span className="rpe-other" title={`RPE ${other}`}>
					{other}
				</span>
			)}
			{chips.map(({ value, selected }) => (
				<button
					key={value}
					type="button"
					className="rpe-chip"
					aria-pressed={selected}
					aria-label={`${label} RPE ${value}`}
					onClick={() => onChange(toggleRpe(rpe, value))}
				>
					{value}
				</button>
			))}
		</fieldset>
	);
}
