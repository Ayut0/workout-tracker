import { describe, expect, it } from "vitest";
import {
	addWeeks,
	countWeeklySets,
	formatSetCount,
	startOfWeek,
	type WeeklySetsWorkout,
} from "./weeklySets";

// Local times, so the tests hold in any time zone. 2026-11-09 is a Monday.
const MONDAY = new Date(2026, 10, 9).getTime();
const at = (day: number, hours = 12, minutes = 0) =>
	new Date(2026, 10, day, hours, minutes).getTime();

const BENCH = {
	primaryMuscles: ["chest" as const],
	secondaryMuscles: ["triceps" as const, "front-delts" as const],
};
const ROW = { primaryMuscles: ["upper-back" as const, "lats" as const] };
const DONE = at(9, 13);

function workout(
	startedAt: number,
	exercises: WeeklySetsWorkout["exercises"],
): WeeklySetsWorkout {
	return { workout: { startedAt }, exercises };
}

describe("startOfWeek", () => {
	it("is Monday 00:00 local time for every day of that week", () => {
		expect(startOfWeek(MONDAY)).toBe(MONDAY);
		expect(startOfWeek(at(9, 0, 0))).toBe(MONDAY);
		expect(startOfWeek(at(12, 18))).toBe(MONDAY);
		// Sunday 23:59 is still the same week.
		expect(startOfWeek(at(15, 23, 59))).toBe(MONDAY);
	});

	it("starts a new week at the next Monday 00:00", () => {
		expect(startOfWeek(at(16, 0, 0))).toBe(new Date(2026, 10, 16).getTime());
	});

	it("goes back across a month boundary", () => {
		// Sunday 1 Nov 2026 belongs to the week of Monday 26 Oct.
		expect(startOfWeek(new Date(2026, 10, 1, 9).getTime())).toBe(
			new Date(2026, 9, 26).getTime(),
		);
	});
});

describe("addWeeks", () => {
	it("moves by whole calendar weeks, staying on Monday 00:00", () => {
		expect(addWeeks(MONDAY, 1)).toBe(new Date(2026, 10, 16).getTime());
		expect(addWeeks(MONDAY, -2)).toBe(new Date(2026, 9, 26).getTime());
	});
});

describe("countWeeklySets", () => {
	it("counts a complete set as 1 for each primary and 0.5 for each secondary muscle", () => {
		const counts = countWeeklySets(
			[
				workout(at(10), [
					{
						exercise: BENCH,
						sets: [{ completedAt: DONE }, { completedAt: DONE }],
					},
				]),
			],
			MONDAY,
		);
		expect(counts).toEqual([
			{ muscle: "chest", sets: 2 },
			{ muscle: "front-delts", sets: 1 },
			{ muscle: "triceps", sets: 1 },
		]);
	});

	it("adds up across exercises and workouts, sorted by most sets", () => {
		const counts = countWeeklySets(
			[
				workout(at(9), [
					{ exercise: BENCH, sets: [{ completedAt: DONE }] },
					{ exercise: ROW, sets: [{ completedAt: DONE }] },
				]),
				workout(at(12), [
					{
						exercise: { primaryMuscles: ["triceps"] },
						sets: [{ completedAt: DONE }, { completedAt: DONE }],
					},
				]),
			],
			MONDAY,
		);
		expect(counts).toEqual([
			{ muscle: "triceps", sets: 2.5 },
			// Equal counts keep the muscle vocabulary's order.
			{ muscle: "chest", sets: 1 },
			{ muscle: "lats", sets: 1 },
			{ muscle: "upper-back", sets: 1 },
			{ muscle: "front-delts", sets: 0.5 },
		]);
	});

	it("leaves out warm-ups and incomplete sets", () => {
		const counts = countWeeklySets(
			[
				workout(at(10), [
					{
						exercise: BENCH,
						sets: [
							{ completedAt: DONE, warmup: true },
							{},
							{ warmup: true },
							{ completedAt: DONE, warmup: false },
						],
					},
				]),
			],
			MONDAY,
		);
		expect(counts).toEqual([
			{ muscle: "chest", sets: 1 },
			{ muscle: "front-delts", sets: 0.5 },
			{ muscle: "triceps", sets: 0.5 },
		]);
	});

	it("counts a workout in the week it started, wherever its sets fall", () => {
		const sundayNight = at(15, 23, 30);
		const afterMidnight = at(16, 0, 30);
		const counts = countWeeklySets(
			[
				workout(sundayNight, [
					{ exercise: ROW, sets: [{ completedAt: afterMidnight }] },
				]),
				// Monday 00:00 of the next week is outside this week.
				workout(new Date(2026, 10, 16).getTime(), [
					{ exercise: BENCH, sets: [{ completedAt: afterMidnight }] },
				]),
				// Sunday 23:59 of the week before is outside it too.
				workout(at(8, 23, 59), [
					{ exercise: BENCH, sets: [{ completedAt: DONE }] },
				]),
			],
			MONDAY,
		);
		expect(counts).toEqual([
			{ muscle: "lats", sets: 1 },
			{ muscle: "upper-back", sets: 1 },
		]);
	});

	it("counts a set the same whatever its exercise measures", () => {
		const plank = { primaryMuscles: ["abs" as const] };
		const counts = countWeeklySets(
			[workout(at(10), [{ exercise: plank, sets: [{ completedAt: DONE }] }])],
			MONDAY,
		);
		expect(counts).toEqual([{ muscle: "abs", sets: 1 }]);
	});

	it("skips exercises with no muscles or no library exercise", () => {
		const counts = countWeeklySets(
			[
				workout(at(10), [
					{ exercise: {}, sets: [{ completedAt: DONE }] },
					{ exercise: undefined, sets: [{ completedAt: DONE }] },
				]),
			],
			MONDAY,
		);
		expect(counts).toEqual([]);
	});

	it("counts a muscle listed twice once, as primary when it is in both lists", () => {
		const counts = countWeeklySets(
			[
				workout(at(10), [
					{
						exercise: {
							primaryMuscles: ["glutes", "glutes"],
							secondaryMuscles: ["glutes", "hamstrings", "hamstrings"],
						},
						sets: [{ completedAt: DONE }],
					},
				]),
			],
			MONDAY,
		);
		expect(counts).toEqual([
			{ muscle: "glutes", sets: 1 },
			{ muscle: "hamstrings", sets: 0.5 },
		]);
	});
});

describe("formatSetCount", () => {
	it("shows whole sets plainly and halves as .5", () => {
		expect(formatSetCount(3)).toBe("3");
		expect(formatSetCount(2.5)).toBe("2.5");
		expect(formatSetCount(0.5)).toBe("0.5");
	});
});
