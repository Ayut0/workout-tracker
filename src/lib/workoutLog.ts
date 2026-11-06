import type { WeightUnit } from "../db/types";
import { parseWeightInput } from "./units";

/**
 * Pure helpers for logging a workout. The writes themselves live in
 * `src/db/workoutLog.ts`; these hold the rules that need no database.
 */

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/** Hours (local time) at which the default workout name changes. */
const AFTERNOON_FROM_HOUR = 12;
const EVENING_FROM_HOUR = 17;
const NIGHT_FROM_HOUR = 22;
const MORNING_FROM_HOUR = 5;

/**
 * The name a new workout gets when none is given, from the local time it
 * starts: "Morning workout", "Afternoon workout", "Evening workout" or
 * "Night workout".
 */
export function nameWorkoutFor(startedAt: number): string {
	const hour = new Date(startedAt).getHours();
	if (hour >= NIGHT_FROM_HOUR || hour < MORNING_FROM_HOUR) {
		return "Night workout";
	}
	if (hour >= EVENING_FROM_HOUR) return "Evening workout";
	if (hour >= AFTERNOON_FROM_HOUR) return "Afternoon workout";
	return "Morning workout";
}

/**
 * Time since a workout started as a clock, e.g. "4:05" or "1:02:03".
 * Negative spans (a clock that moved back) show as "0:00".
 */
export function formatElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / MS_PER_SECOND));
	const seconds = totalSeconds % SECONDS_PER_MINUTE;
	const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
	const minutes = totalMinutes % MINUTES_PER_HOUR;
	const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
	const ss = String(seconds).padStart(2, "0");
	if (hours === 0) return `${minutes}:${ss}`;
	return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
}

/**
 * What a typed set field means: a value to store, `undefined` to clear the
 * field (blank text), or not ok while the text is not a valid entry yet.
 */
export type SetFieldInput =
	| { ok: true; value: number | undefined }
	| { ok: false };

/** Reads a weight field typed in the user's unit; the value is in kg. */
export function readWeightField(text: string, unit: WeightUnit): SetFieldInput {
	if (text.trim() === "") return { ok: true, value: undefined };
	const kg = parseWeightInput(text, unit);
	return kg === undefined ? { ok: false } : { ok: true, value: kg };
}

const REPS_INPUT = /^\d+$/;

/** Reads a reps field: a whole number of reps, 0 or more. */
export function readRepsField(text: string): SetFieldInput {
	const trimmed = text.trim();
	if (trimmed === "") return { ok: true, value: undefined };
	if (!REPS_INPUT.test(trimmed)) return { ok: false };
	return { ok: true, value: Number(trimmed) };
}
