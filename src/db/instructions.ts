import type { ExerciseInstructions } from "./types";

/**
 * An exercise's instructions (ADR-0020): how it is performed, as plain text
 * and a web link, both optional. The library form and the backup check share
 * these rules, so a restore accepts whatever the app can save. Pure.
 */

/** Far more than a few form cues need; stops runaway pastes. */
export const MAX_INSTRUCTIONS_LENGTH = 2000;
/** The common practical limit for a URL. */
export const MAX_INSTRUCTIONS_URL_LENGTH = 2000;

/** What the lifter typed into the instructions form. */
export interface InstructionsInput {
	text: string;
	url: string;
}

export type InstructionsResult =
	| { ok: true; instructions: ExerciseInstructions }
	| { ok: false; field: "text" | "url"; reason: string };

/**
 * Instructions text as stored: the ends trimmed, the line breaks inside kept,
 * and nothing at all when blank, so clearing it leaves no empty field.
 */
export function tidyInstructions(text: string): string | undefined {
	const trimmed = text.trim();
	return trimmed === "" ? undefined : trimmed;
}

/**
 * What is wrong with an instructions link, or undefined when it is fine.
 * `url` is already trimmed and not blank.
 *
 * Only a full http or https address may be stored (ADR-0020): the link is
 * opened by a tap, so another scheme (`javascript:`, `data:`…) must never
 * get through, and a bare "example.com/x" is rejected rather than guessed.
 */
export function checkInstructionsUrl(url: string): string | undefined {
	if (url.length > MAX_INSTRUCTIONS_URL_LENGTH) {
		return `A link can be at most ${formatCount(MAX_INSTRUCTIONS_URL_LENGTH)} characters.`;
	}
	const problem =
		"A link must be a full web address starting with http:// or https://.";
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return problem;
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
		return problem;
	if (parsed.hostname === "") return problem;
	return undefined;
}

/** A count with thousands separators, e.g. 2,000. */
export function formatCount(count: number): string {
	return count.toLocaleString("en-US");
}

/** Tidies and checks the form's text and link; nothing is stored for a blank one. */
export function prepareInstructions(
	input: InstructionsInput,
): InstructionsResult {
	const text = tidyInstructions(input.text);
	if (text !== undefined && text.length > MAX_INSTRUCTIONS_LENGTH) {
		return {
			ok: false,
			field: "text",
			reason: `Instructions can be at most ${formatCount(MAX_INSTRUCTIONS_LENGTH)} characters (this is ${formatCount(text.length)}).`,
		};
	}
	const url = tidyInstructions(input.url);
	if (url !== undefined) {
		const problem = checkInstructionsUrl(url);
		if (problem !== undefined)
			return { ok: false, field: "url", reason: problem };
	}
	const instructions: ExerciseInstructions = {};
	if (text !== undefined) instructions.instructions = text;
	if (url !== undefined) instructions.instructionsUrl = url;
	return { ok: true, instructions };
}
