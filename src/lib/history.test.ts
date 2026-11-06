import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "../db/history";
import {
	describeRescheduleError,
	formatDuration,
	parseDateTimeLocal,
	summarizeWorkout,
	toDateTimeLocal,
} from "./history";

const MINUTE = 60_000;

describe("summarizeWorkout", () => {
	const entry: HistoryEntry = {
		workout: { id: "w", name: "Push", startedAt: 0, endedAt: 50 * MINUTE },
		exercises: [
			{
				workoutExercise: {
					id: "a",
					workoutId: "w",
					exerciseId: "bench",
					order: 0,
				},
				exercise: { id: "bench", name: "Bench Press", nameKey: "bench press" },
				sets: [
					{
						id: "1",
						workoutExerciseId: "a",
						order: 0,
						weightKg: 100,
						reps: 5,
						completedAt: 1,
					},
					{ id: "2", workoutExerciseId: "a", order: 1, weightKg: 100, reps: 5 },
				],
			},
			{
				workoutExercise: {
					id: "b",
					workoutId: "w",
					exerciseId: "gone",
					order: 1,
				},
				exercise: undefined,
				sets: [
					{
						id: "3",
						workoutExerciseId: "b",
						order: 0,
						weightKg: 20,
						reps: 10,
						completedAt: 1,
					},
				],
			},
		],
	};

	it("sums complete sets' volume over every exercise and counts sets", () => {
		expect(summarizeWorkout(entry)).toEqual({
			durationMs: 50 * MINUTE,
			volumeKg: 700,
			exercises: [
				{ workoutExerciseId: "a", name: "Bench Press", setCount: 2 },
				{ workoutExerciseId: "b", name: "Unknown exercise", setCount: 1 },
			],
		});
	});

	it("has no duration for a workout that has not ended", () => {
		const open = { ...entry, workout: { id: "w", name: "Push", startedAt: 0 } };
		expect(summarizeWorkout(open).durationMs).toBeUndefined();
	});
});

describe("formatDuration", () => {
	it.each([
		[0, "0 min"],
		[29_999, "0 min"],
		[45 * MINUTE, "45 min"],
		[60 * MINUTE, "1 h"],
		[65 * MINUTE, "1 h 5 min"],
		[-5 * MINUTE, "0 min"],
	])("shows %d ms as %s", (ms, text) => {
		expect(formatDuration(ms)).toBe(text);
	});
});

describe("datetime-local values", () => {
	it("formats a time in local time to the minute", () => {
		const ms = new Date(2026, 10, 4, 7, 5, 42).getTime();
		expect(toDateTimeLocal(ms)).toBe("2026-11-04T07:05");
	});

	it("reads a value back as local time", () => {
		expect(parseDateTimeLocal("2026-11-04T07:05")).toBe(
			new Date(2026, 10, 4, 7, 5).getTime(),
		);
	});

	it.each(["", "2026-11-04", "2026-02-31T10:00", "2026-13-01T10:00", "nope"])(
		"rejects %j",
		(text) => {
			expect(parseDateTimeLocal(text)).toBeUndefined();
		},
	);
});

describe("describeRescheduleError", () => {
	it("explains each refusal", () => {
		expect(describeRescheduleError({ ok: false, reason: "future" })).toMatch(
			/future/,
		);
		expect(
			describeRescheduleError({ ok: false, reason: "after-active" }),
		).toMatch(/in progress/);
		expect(describeRescheduleError({ ok: false, reason: "not-found" })).toMatch(
			/no longer exists/,
		);
	});
});
