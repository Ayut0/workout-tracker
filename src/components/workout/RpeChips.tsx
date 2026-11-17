import { buildRpeOtherLabel, describeRpeChips } from "../../lib/rpe";

type RpeChipsProps = {
	rpe: number | undefined;
	/** Names the set, e.g. "Bench Press set 1". */
	label: string;
	/**
	 * A chip was tapped. The caller decides set or clear against the stored
	 * RPE (`updateSet` `toggleRpe`), not against this render's props.
	 */
	onToggle: (tapped: number) => void;
};

/**
 * The RPE chip row of a set (#64): 6 to 10, one tap sets, tapping the
 * selected chip clears (decided by the write, not here). An RPE no chip
 * stands for (an imported 8.5) is shown before the chips until a tap replaces it.
 */
export function RpeChips({ rpe, label, onToggle }: RpeChipsProps) {
	const { chips, other } = describeRpeChips(rpe);
	return (
		<fieldset className="rpe-chips" aria-label={`${label} RPE`}>
			<legend className="rpe-legend">RPE</legend>
			{other !== undefined && (
				<span
					className="rpe-other"
					role="img"
					aria-label={buildRpeOtherLabel(other)}
					title={buildRpeOtherLabel(other)}
				>
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
					onClick={() => onToggle(value)}
				>
					{value}
				</button>
			))}
		</fieldset>
	);
}
