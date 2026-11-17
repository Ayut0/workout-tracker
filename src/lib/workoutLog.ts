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
export function buildWorkoutName(startedAt: number): string {
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

/**
 * Largest values a set field accepts. Digit-only input is otherwise
 * unbounded ("9" typed 400 times becomes Infinity, which JSON stores as
 * null), so each reader rejects what is above these (ADR-0012).
 */
export const MAX_REPS = 9_999;
/** 24 hours. Longer holds are not a set. */
export const MAX_SECONDS = 86_400;
/** 1,000 km. */
export const MAX_DISTANCE_M = 1_000_000;

function capFieldValue(value: number, cap: number): SetFieldInput {
	return Number.isFinite(value) && value <= cap
		? { ok: true, value }
		: { ok: false };
}

const REPS_INPUT = /^\d+$/;

/** Reads a reps field: a whole number of reps, 0 to MAX_REPS. */
export function readRepsField(text: string): SetFieldInput {
	const trimmed = text.trim();
	if (trimmed === "") return { ok: true, value: undefined };
	if (!REPS_INPUT.test(trimmed)) return { ok: false };
	return capFieldValue(Number(trimmed), MAX_REPS);
}

const SECONDS_INPUT = /^\d+$/;
const MINUTES_SECONDS_INPUT = /^(\d+):([0-5]\d)$/;

/**
 * Reads a set's time: whole seconds ("45") or minutes and seconds ("1:30"),
 * up to MAX_SECONDS. Longer holds are typed as plain seconds.
 */
export function readSecondsField(text: string): SetFieldInput {
	const trimmed = text.trim();
	if (trimmed === "") return { ok: true, value: undefined };
	if (SECONDS_INPUT.test(trimmed)) {
		return capFieldValue(Number(trimmed), MAX_SECONDS);
	}
	const match = MINUTES_SECONDS_INPUT.exec(trimmed);
	if (!match) return { ok: false };
	return capFieldValue(
		Number(match[1]) * SECONDS_PER_MINUTE + Number(match[2]),
		MAX_SECONDS,
	);
}

const DISTANCE_INPUT = /^\d+(?:[.,]\d*)?$|^[.,]\d+$/;

/** Reads a set's distance in metres, 0 to MAX_DISTANCE_M; a decimal comma is accepted. */
export function readDistanceField(text: string): SetFieldInput {
	const trimmed = text.trim();
	if (trimmed === "") return { ok: true, value: undefined };
	if (!DISTANCE_INPUT.test(trimmed)) return { ok: false };
	return capFieldValue(Number(trimmed.replace(",", ".")), MAX_DISTANCE_M);
}
