import type { HistoryEntry, RescheduleWorkoutResult } from "../db/history";
import { sumVolume } from "./metrics";

/** Pure helpers for History (#30); the reads and writes live in `src/db/history.ts`. */

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

/** What a History row shows about a workout, in stored units. */
export interface WorkoutSummary {
	/** End minus start; undefined for a workout that has not ended. */
	durationMs: number | undefined;
	/** Volume of the whole workout: every exercise's complete sets, in kg. */
	volumeKg: number;
	/** Each exercise in order with how many sets it has. */
	exercises: { workoutExerciseId: string; name: string; setCount: number }[];
}

export function summarizeWorkout(entry: HistoryEntry): WorkoutSummary {
	const { workout } = entry;
	return {
		durationMs:
			workout.endedAt === undefined
				? undefined
				: workout.endedAt - workout.startedAt,
		volumeKg: entry.exercises.reduce(
			(total, exercise) => total + sumVolume(exercise.sets),
			0,
		),
		exercises: entry.exercises.map((exercise) => ({
			workoutExerciseId: exercise.workoutExercise.id,
			name: exercise.exercise?.name ?? "Unknown exercise",
			setCount: exercise.sets.length,
		})),
	};
}

/** A workout's length in whole minutes, e.g. "45 min" or "1 h 5 min". */
export function formatDuration(ms: number): string {
	const totalMinutes = Math.max(0, Math.round(ms / MS_PER_MINUTE));
	const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
	const minutes = totalMinutes % MINUTES_PER_HOUR;
	if (hours === 0) return `${minutes} min`;
	if (minutes === 0) return `${hours} h`;
	return `${hours} h ${minutes} min`;
}

/** A time as a `datetime-local` input value in local time, e.g. "2026-11-04T07:05". */
export function toDateTimeLocal(ms: number): string {
	const date = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const DATE_TIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Reads a `datetime-local` value (local time) as epoch ms; undefined if it is not a real time. */
export function parseDateTimeLocal(text: string): number | undefined {
	const match = DATE_TIME_LOCAL.exec(text.trim());
	if (!match) return undefined;
	const [year, month, day, hour, minute] = match.slice(1).map(Number);
	if (
		year === undefined ||
		month === undefined ||
		day === undefined ||
		hour === undefined ||
		minute === undefined
	) {
		return undefined;
	}
	const date = new Date(year, month - 1, day, hour, minute);
	// new Date rolls 31 Feb over to March; a rolled-over date was not real.
	if (date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
	return date.getTime();
}

/** Why a new start time was refused, for the user. */
export function describeRescheduleError(
	result: Extract<RescheduleWorkoutResult, { ok: false }>,
): string {
	switch (result.reason) {
		case "future":
			return "A workout cannot start in the future.";
		case "after-active":
			return "A past workout must start before the workout in progress.";
		case "not-found":
			return "This workout no longer exists.";
	}
}
