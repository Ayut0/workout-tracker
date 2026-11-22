import {
	checkInstructionsUrl,
	formatCount,
	type InstructionsInput,
	MAX_INSTRUCTIONS_LENGTH,
	tidyInstructions,
} from "../db/instructions";
import type { ExerciseInstructions } from "../db/types";

/** The counter appears from this many characters (90% of the cap). */
const INSTRUCTIONS_COUNTER_FROM = MAX_INSTRUCTIONS_LENGTH * 0.9;

/**
 * The instructions text's length against the cap, e.g. "1,850 / 2,000",
 * once it nears the cap; undefined before that. Counts the text as it would
 * be saved (ends trimmed), the same length the cap is checked on.
 */
export function getInstructionsCounter(text: string): string | undefined {
	const length = text.trim().length;
	if (length < INSTRUCTIONS_COUNTER_FROM) return undefined;
	return `${formatCount(length)} / ${formatCount(MAX_INSTRUCTIONS_LENGTH)}`;
}

/** True when saving the form would change what is stored (blank = nothing). */
export function isInstructionsDraftChanged(
	draft: InstructionsInput,
	stored: ExerciseInstructions,
): boolean {
	return (
		tidyInstructions(draft.text) !== stored.instructions ||
		tidyInstructions(draft.url) !== stored.instructionsUrl
	);
}

/**
 * Defence in depth (ADR-0020): only a full http or https address is rendered
 * as a tappable link, even though storage already refuses anything else, so a
 * `javascript:` or `data:` link from an old backup or a bug never becomes one.
 */
export function isSafeInstructionsLink(url: string): boolean {
	return url.trim() !== "" && checkInstructionsUrl(url.trim()) === undefined;
}

/**
 * How an instructions link is shown (ADR-0020): its host without "www.", so
 * the lifter sees where a tap goes. The stored URL is always http or https;
 * anything unreadable is shown as it is rather than hidden.
 */
export function getLinkLabel(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

/** What the workout card shows of an exercise's instructions. */
export interface InstructionsToShow {
	text: string | undefined;
	url: string | undefined;
}

/**
 * What to show of an exercise's instructions while logging (ADR-0020): the
 * text trimmed, and the link only if it is safe to render; undefined when
 * neither is left, so the card shows no row.
 */
export function getInstructionsToShow({
	instructions,
	instructionsUrl,
}: {
	instructions?: string | undefined;
	instructionsUrl?: string | undefined;
}): InstructionsToShow | undefined {
	const text = tidyInstructions(instructions ?? "");
	const url =
		instructionsUrl !== undefined && isSafeInstructionsLink(instructionsUrl)
			? instructionsUrl.trim()
			: undefined;
	if (text === undefined && url === undefined) return undefined;
	return { text, url };
}
