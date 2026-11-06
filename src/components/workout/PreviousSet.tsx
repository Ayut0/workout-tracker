type PreviousSetProps = {
	/** The previous set as shown, e.g. "100 kg × 5"; undefined when there is none. */
	text: string | undefined;
	/** Names the set it fills, e.g. "Bench Press set 1". */
	setLabel: string;
	onFill: () => void;
};

/**
 * A cell of the Previous column (#28): what this set did last time. Tapping
 * it copies that weight and reps into today's set; with nothing to copy it
 * shows "–".
 */
export function PreviousSet({ text, setLabel, onFill }: PreviousSetProps) {
	if (text === undefined) {
		return (
			<span className="previous-none">
				<span aria-hidden="true">–</span>
				<span className="visually-hidden">No previous {setLabel}</span>
			</span>
		);
	}
	return (
		<button
			type="button"
			className="previous-fill"
			aria-label={`Fill ${setLabel} with previous ${text}`}
			onClick={() => {
				// A field still focused shows its draft, not the stored value
				// (useDraftField); blur it so the filled values show. Tapping a
				// button does not always move focus (iOS Safari).
				if (document.activeElement instanceof HTMLElement) {
					document.activeElement.blur();
				}
				onFill();
			}}
		>
			{text}
		</button>
	);
}
