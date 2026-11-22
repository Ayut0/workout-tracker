import { MAX_PLANNED_REPS, type PlannedTargets } from "../db/types";

/**
 * A planned set's targets (ADR-0014): the rep range it aims for and the reps
 * it should leave in reserve (RIR). Typed in the template editor, copied into
 * the workout and shown while logging.
 */

/** What a rep range field holds once read; both ends, or neither. */
export type RepRangeInput =
	| { ok: true; repMin: number | undefined; repMax: number | undefined }
	| { ok: false };

/*
 * Values beyond MAX_PLANNED_REPS (and MAX_PLANNED_RIR, which the 2-digit RIR pattern keeps)
 * are typos, and a huge one would not survive a JSON backup (Infinity is
 * written as null). backupFormat.ts enforces the same caps.
 */

/** A whole number of reps, 1 to 3 digits (the cap is checked after). */
const REPS = /^\d{1,3}$/;

/** A whole number for RIR, 1 or 2 digits. */
const RIR = /^\d{1,2}$/;

/** "6-8" or "6 to 8", with spaces allowed around the separator. */
const RANGE = /^(\d{1,3})\s*(?:-|to)\s*(\d{1,3})$/i;

/**
 * Brings what a phone keyboard can type to plain ASCII: NFKC turns full-width
 * digits, spaces and "～" into their plain forms, then the minus sign, the
 * en and em dashes and the tilde forms become "-".
 */
function normalise(text: string): string {
	return text
		.normalize("NFKC")
		.replace(/[\u2212\u2013\u2014~\u301C]/g, "-")
		.trim();
}

/**
 * Reads a rep range field: "8" plans exactly 8 (8–8), "6-8", "6–8", "6~8" or
 * "6 to 8" plans 6 to 8 (full-width digits work too), and blank clears the
 * range. The ends are whole numbers from 1 to 999 and the bottom is not
 * above the top.
 */
export function readRepRangeInput(text: string): RepRangeInput {
	const trimmed = normalise(text);
	if (trimmed === "") return { ok: true, repMin: undefined, repMax: undefined };
	if (REPS.test(trimmed)) {
		const reps = Number(trimmed);
		if (reps < 1 || reps > MAX_PLANNED_REPS) return { ok: false };
		return { ok: true, repMin: reps, repMax: reps };
	}
	const match = RANGE.exec(trimmed);
	if (!match) return { ok: false };
	const repMin = Number(match[1]);
	const repMax = Number(match[2]);
	if (repMin < 1 || repMax > MAX_PLANNED_REPS || repMin > repMax)
		return { ok: false };
	return { ok: true, repMin, repMax };
}

/** What a target RIR field holds once read. */
export type RirInput = { ok: true; value: number | undefined } | { ok: false };

/** Reads a target RIR field: a whole number from 0 to 99; blank clears it. */
export function readRirInput(text: string): RirInput {
	const trimmed = text.normalize("NFKC").trim();
	if (trimmed === "") return { ok: true, value: undefined };
	if (!RIR.test(trimmed)) return { ok: false };
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
