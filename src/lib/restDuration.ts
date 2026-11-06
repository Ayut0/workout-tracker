import type { Exercise, Settings } from "../db/types";

/** Shortest rest the app accepts, in seconds. */
export const MIN_REST_SECONDS = 5;
/** Longest rest the app accepts, in seconds (one hour). */
export const MAX_REST_SECONDS = 3600;

const SECONDS_PER_MINUTE = 60;
const PLAIN_SECONDS = /^\d+$/;
const MINUTES_SECONDS = /^(\d+):([0-5]\d)$/;

/** The rest after a set of this exercise: its own rest if set, else the default. */
export function resolveRestSeconds(
	exercise: Pick<Exercise, "restSeconds"> | undefined,
	settings: Pick<Settings, "restSeconds">,
): number {
	return exercise?.restSeconds ?? settings.restSeconds;
}

/**
 * Reads a rest duration typed as seconds ("90") or minutes and seconds
 * ("1:30"). Returns undefined when malformed or outside the allowed range.
 */
export function parseRestSeconds(text: string): number | undefined {
	const trimmed = text.trim();
	let seconds: number | undefined;
	if (PLAIN_SECONDS.test(trimmed)) {
		seconds = Number(trimmed);
	} else {
		const match = MINUTES_SECONDS.exec(trimmed);
		if (match) {
			seconds = Number(match[1]) * SECONDS_PER_MINUTE + Number(match[2]);
		}
	}
	if (
		seconds === undefined ||
		seconds < MIN_REST_SECONDS ||
		seconds > MAX_REST_SECONDS
	) {
		return undefined;
	}
	return seconds;
}

/** A rest duration as minutes and seconds, e.g. 90 is "1:30". */
export function formatRestDuration(seconds: number): string {
	const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
	const rest = seconds % SECONDS_PER_MINUTE;
	return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

/**
 * Reads an exercise's own rest as typed: blank clears it so the default rest
 * applies (`{ seconds: undefined }`); otherwise as parseRestSeconds. Null when
 * the text is not a valid rest.
 */
export function parseRestOverride(
	text: string,
): { seconds: number | undefined } | null {
	if (text.trim() === "") return { seconds: undefined };
	const seconds = parseRestSeconds(text);
	return seconds === undefined ? null : { seconds };
}
