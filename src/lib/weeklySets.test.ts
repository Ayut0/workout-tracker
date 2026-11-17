import { afterAll, describe, expect, it } from "vitest";
import {
	addWeeks,
	countWeeklySets,
	formatSetCount,
	shiftWeek,
	startOfWeek,
	type WeeklySetsWorkout,
} from "./weeklySets";

// Local times, so the tests hold in any time zone. 2026-11-09 is a Monday.
const MONDAY = new Date(2026, 10, 9).getTime();
const buildTimestamp = (day: number, hours = 12, minutes = 0) =>
	new Date(2026, 10, day, hours, minutes).getTime();

const BENCH = {
	primaryMuscles: ["chest" as const],
	secondaryMuscles: ["triceps" as const, "front-delts" as const],
};
const ROW = { primaryMuscles: ["upper-back" as const, "lats" as const] };
const DONE = buildTimestamp(9, 13);

function buildWorkout(
	startedAt: number,
	exercises: WeeklySetsWorkout["exercises"],
): WeeklySetsWorkout {
	return { workout: { startedAt }, exercises };
}

describe("startOfWeek", () => {
	it("is Monday 00:00 local time for every day of that week", () => {
		expect(startOfWeek(MONDAY)).toBe(MONDAY);
		expect(startOfWeek(buildTimestamp(9, 0, 0))).toBe(MONDAY);
		expect(startOfWeek(buildTimestamp(12, 18))).toBe(MONDAY);
		// Sunday 23:59 is still the same week.
		expect(startOfWeek(buildTimestamp(15, 23, 59))).toBe(MONDAY);
	});

	it("starts a new week at the next Monday 00:00", () => {
		expect(startOfWeek(buildTimestamp(16, 0, 0))).toBe(
			new Date(2026, 10, 16).getTime(),
		);
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

// Zones whose daylight-saving change happens at midnight (00:00 does not
// exist on the spring-forward day, or happens twice on the fall-back day),
// plus ordinary and half-hour-shift zones. The week boundaries must tile the
// time line: every instant is in exactly one week.
const ZONES = [
	"America/Havana",
	"Africa/Cairo",
	"America/Santiago",
	"Asia/Beirut",
	"America/New_York",
	"Europe/London",
	"Asia/Tokyo",
	"Australia/Lord_Howe",
];
// Node re-reads TZ when it is assigned. The project has no Node typings, so
// reach process.env through a minimal local type.
const env = getNodeEnv();
function getNodeEnv(): { TZ?: string } {
	const node: unknown = Reflect.get(globalThis, "process");
	const env = typeof node === "object" ? Reflect.get(node ?? {}, "env") : null;
	if (typeof env !== "object" || env === null) {
		throw new Error("These tests need Node's process.env to set TZ.");
	}
	return env;
}
const HALF_HOUR = 30 * 60 * 1000;
const SWEEP_FROM = Date.UTC(2023, 0, 1);
const SWEEP_TO = Date.UTC(2027, 0, 1);

describe("week boundaries across time zones", () => {
	const originalTz = env.TZ;
	afterAll(() => {
		if (originalTz === undefined) delete env.TZ;
		else env.TZ = originalTz;
	});

	it.each(ZONES)("tile the time line in %s", (zone) => {
		env.TZ = zone;
		// Guard: the zone really applies (Node re-reads TZ on assignment).
		expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
		const failures: string[] = [];
		for (let t = SWEEP_FROM; t < SWEEP_TO; t += HALF_HOUR) {
			const start = startOfWeek(t);
			const end = addWeeks(start, 1);
			const startDay = new Date(start);
			const ok =
				start <= t &&
				t < end &&
				// Contiguous: the next week starts exactly where this one ends,
				// and this week starts exactly where the previous one ends.
				startOfWeek(end) === end &&
				startOfWeek(end - 1) === start &&
				startOfWeek(start) === start &&
				addWeeks(end, -1) === start &&
				// A Monday, and the earliest instant of that calendar date.
				startDay.getDay() === 1 &&
				new Date(start - 1).getDate() !== startDay.getDate();
			if (!ok && failures.length < 5) {
				failures.push(new Date(t).toISOString());
			}
		}
		expect(failures).toEqual([]);
	});

	it("starts the week at the first instant of Monday when 00:00 is skipped", () => {
		// Havana 2025: clocks jump 23:59 Sat 8 Mar to 01:00 Sun 9 Mar, so a
		// Sunday time after the jump still belongs to the week of Mon 3 Mar.
		env.TZ = "America/Havana";
		const sunday = new Date(2025, 2, 9, 12).getTime();
		expect(startOfWeek(sunday)).toBe(new Date(2025, 2, 3).getTime());
		expect(new Date(startOfWeek(sunday)).getHours()).toBe(0);
		// Cairo 2025: the week of Mon 21 Apr starts at 00:00, and the next one
		// (Mon 28 Apr) follows from calendar days, not from 7 * 24 hours.
		env.TZ = "Africa/Cairo";
		const monday = new Date(2025, 3, 21, 12).getTime();
		const start = startOfWeek(monday);
		expect(new Date(start).getHours()).toBe(0);
		expect(new Date(addWeeks(start, 1)).getHours()).toBe(0);
	});
});

describe("shiftWeek", () => {
	const THIS_WEEK = MONDAY;
	const LAST_WEEK = addWeeks(MONDAY, -1);

	it("steps back from the current week, pinning the earlier week", () => {
		expect(shiftWeek(undefined, THIS_WEEK, -1)).toBe(LAST_WEEK);
		expect(shiftWeek(LAST_WEEK, THIS_WEEK, -1)).toBe(addWeeks(MONDAY, -2));
	});

	it("goes back to following the current week when stepping up to it", () => {
		expect(shiftWeek(LAST_WEEK, THIS_WEEK, 1)).toBeUndefined();
	});

	it("never goes past the current week", () => {
		expect(shiftWeek(undefined, THIS_WEEK, 1)).toBeUndefined();
	});

	it("keeps a pinned week pinned, and drops a pin that became current", () => {
		const week = addWeeks(MONDAY, -3);
		expect(shiftWeek(week, THIS_WEEK, 1)).toBe(addWeeks(MONDAY, -2));
		// The clock rolled into the week that was pinned: it is now "this week".
		expect(shiftWeek(THIS_WEEK, THIS_WEEK, 1)).toBeUndefined();
	});
});

describe("countWeeklySets", () => {
	it("counts a complete set as 1 for each primary and 0.5 for each secondary muscle", () => {
		const counts = countWeeklySets(
			[
				buildWorkout(buildTimestamp(10), [
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
				buildWorkout(buildTimestamp(9), [
					{ exercise: BENCH, sets: [{ completedAt: DONE }] },
					{ exercise: ROW, sets: [{ completedAt: DONE }] },
				]),
				buildWorkout(buildTimestamp(12), [
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
				buildWorkout(buildTimestamp(10), [
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
		const sundayNight = buildTimestamp(15, 23, 30);
		const afterMidnight = buildTimestamp(16, 0, 30);
		const counts = countWeeklySets(
			[
				buildWorkout(sundayNight, [
					{ exercise: ROW, sets: [{ completedAt: afterMidnight }] },
				]),
				// Monday 00:00 of the next week is outside this week.
				buildWorkout(new Date(2026, 10, 16).getTime(), [
					{ exercise: BENCH, sets: [{ completedAt: afterMidnight }] },
				]),
				// Sunday 23:59 of the week before is outside it too.
				buildWorkout(buildTimestamp(8, 23, 59), [
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
			[
				buildWorkout(buildTimestamp(10), [
					{ exercise: plank, sets: [{ completedAt: DONE }] },
				]),
			],
			MONDAY,
		);
		expect(counts).toEqual([{ muscle: "abs", sets: 1 }]);
	});

	it("skips exercises with no muscles or no library exercise", () => {
		const counts = countWeeklySets(
			[
				buildWorkout(buildTimestamp(10), [
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
				buildWorkout(buildTimestamp(10), [
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
