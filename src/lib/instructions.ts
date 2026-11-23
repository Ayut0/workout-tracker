import {
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
