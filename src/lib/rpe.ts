import { roundForDisplay } from "./units";

/**
 * RPE on a set (#64, ADR-0012): a row of chips 6 to 10 under every set. One
 * tap sets the RPE; tapping the selected chip again clears it. Whole numbers
 * only from the chips, but a stored RPE is shown as it is: an imported 8.5
 * (Strong) selects no chip and is shown beside the row until a tap replaces it.
 */

/** The RPEs the chip row offers, in order. */
export const RPE_CHOICES = [6, 7, 8, 9, 10] as const;

/**
 * The RPE after a chip is tapped: the tapped value, or undefined (cleared)
 * when it is the RPE already stored.
 */
export function toggleRpe(
	current: number | undefined,
	tapped: number,
): number | undefined {
	return current === tapped ? undefined : tapped;
}

export interface RpeChip {
	value: number;
	selected: boolean;
}

/** What the chip row shows for a stored RPE. */
export interface RpeChipsView {
	chips: RpeChip[];
	/**
	 * A stored RPE no chip stands for (a decimal such as 8.5, or a value
	 * outside 6 to 10), as text; undefined when a chip or nothing shows it.
	 */
	other: string | undefined;
}

export function describeRpeChips(rpe: number | undefined): RpeChipsView {
	const onRow = RPE_CHOICES.some((choice) => choice === rpe);
	return {
		chips: RPE_CHOICES.map((value) => ({ value, selected: value === rpe })),
		other:
			rpe === undefined || onRow ? undefined : String(roundForDisplay(rpe)),
	};
}
