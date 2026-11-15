import { toggleWarmup } from "../../lib/warmup";

type WarmupToggleProps = {
	warmup: boolean | undefined;
	/** Names the set, e.g. "Bench Press set 1". */
	label: string;
	/** The new mark; undefined clears it. */
	onChange: (warmup: true | undefined) => void;
};

/**
 * The "W" toggle of a set or planned set (#65): marks it as a warm-up, which
 * Volume, Estimated 1RM, records and progression leave out.
 */
export function WarmupToggle({ warmup, label, onChange }: WarmupToggleProps) {
	return (
		<button
			type="button"
			className="set-warmup"
			aria-pressed={warmup === true}
			aria-label={`${label} warm-up`}
			title="Warm-up"
			onClick={() => onChange(toggleWarmup(warmup))}
		>
			W
		</button>
	);
}
