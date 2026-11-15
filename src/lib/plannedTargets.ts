import type { PlannedTargets } from "../db/types";

/**
 * A planned set's targets (ADR-0014): the rep range it aims for and the reps
 * it should leave in reserve (RIR). Typed in the template editor, copied into
 * the workout and shown while logging.
 */

/** What a rep range field holds once read; both ends, or neither. */
export type RepRangeInput =
	| { ok: true; repMin: number | undefined; repMax: number | undefined }
	| { ok: false };

/** A whole number of reps, 0 or more. */
const COUNT = /^\d+$/;

/** "6-8", "6–8", "6—8" or "6 to 8", with spaces allowed around the dash. */
const RANGE = /^(\d+)\s*(?:[-–—]|to)\s*(\d+)$/i;

/**
 * Reads a rep range field: "8" plans exactly 8 (8–8), "6-8" or "6–8" plans 6
 * to 8, and blank clears the range. The ends are whole numbers, 0 or more,
 * and the bottom is not above the top.
 */
export function readRepRangeInput(text: string): RepRangeInput {
	const trimmed = text.trim();
	if (trimmed === "") return { ok: true, repMin: undefined, repMax: undefined };
	if (COUNT.test(trimmed)) {
		const reps = Number(trimmed);
		return { ok: true, repMin: reps, repMax: reps };
	}
	const match = RANGE.exec(trimmed);
	if (!match) return { ok: false };
	const repMin = Number(match[1]);
	const repMax = Number(match[2]);
	if (repMin > repMax) return { ok: false };
	return { ok: true, repMin, repMax };
}

/** What a target RIR field holds once read. */
export type RirInput = { ok: true; value: number | undefined } | { ok: false };

/** Reads a target RIR field: a whole number, 0 or more; blank clears it. */
export function readRirInput(text: string): RirInput {
	const trimmed = text.trim();
	if (trimmed === "") return { ok: true, value: undefined };
	if (!COUNT.test(trimmed)) return { ok: false };
	return { ok: true, value: Number(trimmed) };
}

/**
 * A rep range as typed back into its field: "8" when both ends are equal,
 * "6–8" otherwise, and "" with no range. One end alone shows as that number.
 */
export function formatRepRange(
	repMin: number | undefined,
	repMax: number | undefined,
): string {
	if (repMin === undefined && repMax === undefined) return "";
	if (repMin === undefined || repMax === undefined || repMin === repMax) {
		return String(repMin ?? repMax);
	}
	return `${repMin}–${repMax}`;
}

/** A target RIR as typed back into its field; "" when there is none. */
export function formatRir(rir: number | undefined): string {
	return rir === undefined ? "" : String(rir);
}

/**
 * A set's targets as shown while logging, e.g. "4–6 reps · RIR 2", "8 reps"
 * or "RIR 1"; undefined when it has none.
 */
export function describePlannedTargets(
	targets: PlannedTargets,
): string | undefined {
	const parts: string[] = [];
	const range = formatRepRange(targets.repMin, targets.repMax);
	if (range !== "") parts.push(`${range} ${range === "1" ? "rep" : "reps"}`);
	if (targets.targetRir !== undefined) parts.push(`RIR ${targets.targetRir}`);
	return parts.length === 0 ? undefined : parts.join(" · ");
}
