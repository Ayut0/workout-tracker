import { describe, expect, it } from "vitest";
import type { ExerciseHistoryEntry } from "../db";
import type { WorkoutSet } from "../db/types";
import {
	E1RM_MAX_REPS,
	type ExerciseHistoryInput,
	estimateOneRepMax,
	findBestEstimatedOneRepMax,
	findPersonalRecords,
	listProgressPoints,
	sumVolume,
} from "./metrics";

const DONE = 1_700_000_000_000;

function makeIncompleteSet(fields: Partial<WorkoutSet>): WorkoutSet {
	return { id: "set", workoutExerciseId: "we", order: 0, ...fields };
}

function makeSet(fields: Partial<WorkoutSet>): WorkoutSet {
	return makeIncompleteSet({ completedAt: DONE, ...fields });
}

describe("estimateOneRepMax (Epley)", () => {
	it("is weight × (1 + reps/30)", () => {
		// 100 × (1 + 5/30) = 116.666…
		expect(estimateOneRepMax(makeSet({ weightKg: 100, reps: 5 }))).toBeCloseTo(
			116.6667,
			4,
		);
		// 60 × (1 + 10/30) = 80
		expect(estimateOneRepMax(makeSet({ weightKg: 60, reps: 10 }))).toBe(80);
	});

	it("is the weight itself for a single rep", () => {
		expect(estimateOneRepMax(makeSet({ weightKg: 142.5, reps: 1 }))).toBe(
			142.5,
		);
	});

	it("caps reps at E1RM_MAX_REPS", () => {
		expect(E1RM_MAX_REPS).toBe(12);
		// 50 × (1 + 12/30) = 70, for 12, 20 and 50 reps alike
		expect(estimateOneRepMax(makeSet({ weightKg: 50, reps: 12 }))).toBe(70);
		expect(estimateOneRepMax(makeSet({ weightKg: 50, reps: 20 }))).toBe(70);
		expect(estimateOneRepMax(makeSet({ weightKg: 50, reps: 50 }))).toBe(70);
	});

	it("is undefined for 0 reps or missing reps", () => {
		expect(
			estimateOneRepMax(makeSet({ weightKg: 100, reps: 0 })),
		).toBeUndefined();
		expect(estimateOneRepMax(makeSet({ weightKg: 100 }))).toBeUndefined();
	});

	it("is undefined for bodyweight (0 kg) or missing weight", () => {
		expect(
			estimateOneRepMax(makeSet({ weightKg: 0, reps: 10 })),
		).toBeUndefined();
		expect(estimateOneRepMax(makeSet({ reps: 10 }))).toBeUndefined();
	});

	it("is undefined for an incomplete set", () => {
		expect(
			estimateOneRepMax(makeIncompleteSet({ weightKg: 100, reps: 5 })),
		).toBeUndefined();
	});
});

describe("findBestEstimatedOneRepMax", () => {
	it("is the highest e1RM among complete sets", () => {
		const sets = [
			makeSet({ weightKg: 100, reps: 5 }), // 116.67
			makeSet({ weightKg: 110, reps: 3 }), // 121
			makeIncompleteSet({ weightKg: 200, reps: 1 }), // ignored
			makeSet({ weightKg: 0, reps: 20 }), // no e1RM
		];
		expect(findBestEstimatedOneRepMax(sets)).toBeCloseTo(121, 10);
	});

	it("is undefined when no set has an e1RM", () => {
		expect(findBestEstimatedOneRepMax([])).toBeUndefined();
		expect(findBestEstimatedOneRepMax([makeSet({ reps: 10 })])).toBeUndefined();
	});
});

describe("sumVolume", () => {
	it("sums weight × reps over complete sets", () => {
		const sets = [
			makeSet({ weightKg: 100, reps: 5 }), // 500
			makeSet({ weightKg: 102.5, reps: 3 }), // 307.5
			makeIncompleteSet({ weightKg: 120, reps: 5 }), // ignored
		];
		expect(sumVolume(sets)).toBe(807.5);
	});

	it("uses the full rep count, with no cap", () => {
		expect(sumVolume([makeSet({ weightKg: 20, reps: 50 })])).toBe(1000);
	});

	it("counts 0 for 0 reps, bodyweight (0 kg) and missing values", () => {
		const sets = [
			makeSet({ weightKg: 100, reps: 0 }),
			makeSet({ weightKg: 0, reps: 15 }),
			makeSet({ reps: 15 }),
			makeSet({ weightKg: 100 }),
		];
		expect(sumVolume(sets)).toBe(0);
		expect(sumVolume([])).toBe(0);
	});
});

function makeEntry(id: string, startedAt: number, sets: WorkoutSet[]) {
	return { workout: { id, startedAt }, sets };
}

describe("listProgressPoints", () => {
	it("accepts listExerciseHistory output as is", () => {
		const history: ExerciseHistoryEntry[] = [
			{
				workout: { id: "w1", name: "Push", startedAt: 1000 },
				sets: [makeSet({ weightKg: 100, reps: 5 })],
			},
		];
		const input: readonly ExerciseHistoryInput[] = history;
		expect(listProgressPoints(input)).toHaveLength(1);
	});

	it("gives one point per workout, oldest first", () => {
		const points = listProgressPoints([
			makeEntry("w2", 2000, [makeSet({ weightKg: 105, reps: 5 })]),
			makeEntry("w1", 1000, [
				makeSet({ weightKg: 100, reps: 5 }),
				makeSet({ weightKg: 90, reps: 8 }),
			]),
		]);
		expect(points).toHaveLength(2);
		expect(points[0]).toMatchObject({
			workoutId: "w1",
			date: 1000,
			volumeKg: 1220, // 500 + 720
			maxWeightKg: 100,
		});
		// max(100 × 35/30, 90 × 38/30) = max(116.67, 114)
		expect(points[0]?.bestE1rmKg).toBeCloseTo(116.6667, 4);
		expect(points[1]).toMatchObject({
			workoutId: "w2",
			date: 2000,
			volumeKg: 525,
			maxWeightKg: 105,
		});
		expect(points[1]?.bestE1rmKg).toBeCloseTo(122.5, 10);
	});

	it("merges entries of the same workout (exercise done twice)", () => {
		const points = listProgressPoints([
			makeEntry("w1", 1000, [makeSet({ weightKg: 100, reps: 5 })]),
			makeEntry("w1", 1000, [makeSet({ weightKg: 60, reps: 10 })]),
		]);
		expect(points).toHaveLength(1);
		expect(points[0]?.volumeKg).toBe(1100);
		expect(points[0]?.bestE1rmKg).toBeCloseTo(116.6667, 4);
	});

	it("skips workouts with no complete set", () => {
		const points = listProgressPoints([
			makeEntry("w1", 1000, [makeIncompleteSet({ weightKg: 100, reps: 5 })]),
			makeEntry("w2", 2000, []),
		]);
		expect(points).toEqual([]);
	});

	it("keeps a bodyweight-only workout with no e1RM and 0 volume", () => {
		const points = listProgressPoints([
			makeEntry("w1", 1000, [makeSet({ weightKg: 0, reps: 12 })]),
		]);
		expect(points).toEqual([
			{
				workoutId: "w1",
				date: 1000,
				bestE1rmKg: undefined,
				volumeKg: 0,
				maxWeightKg: undefined,
			},
		]);
	});
});

describe("findPersonalRecords", () => {
	it("finds the best e1RM, heaviest weight and best volume with their workouts", () => {
		const records = findPersonalRecords([
			makeEntry("w1", 1000, [
				makeSet({ weightKg: 100, reps: 10 }), // e1RM 133.33, volume 1000
			]),
			makeEntry("w2", 2000, [
				makeSet({ weightKg: 120, reps: 1 }), // e1RM 120
				makeIncompleteSet({ weightKg: 140, reps: 1 }), // ignored
			]),
		]);
		expect(records.bestE1rm?.workoutId).toBe("w1");
		expect(records.bestE1rm?.kg).toBeCloseTo(133.3333, 4);
		expect(records.heaviestWeight).toEqual({
			kg: 120,
			workoutId: "w2",
			date: 2000,
		});
		expect(records.bestVolume).toEqual({
			kg: 1000,
			workoutId: "w1",
			date: 1000,
		});
	});

	it("keeps the earliest workout on a tie", () => {
		const records = findPersonalRecords([
			makeEntry("w1", 1000, [makeSet({ weightKg: 100, reps: 5 })]),
			makeEntry("w2", 2000, [makeSet({ weightKg: 100, reps: 5 })]),
		]);
		expect(records.heaviestWeight?.workoutId).toBe("w1");
		expect(records.bestVolume?.workoutId).toBe("w1");
	});

	it("has no records without loaded complete sets", () => {
		expect(findPersonalRecords([])).toEqual({
			bestE1rm: undefined,
			heaviestWeight: undefined,
			bestVolume: undefined,
		});
		expect(
			findPersonalRecords([
				makeEntry("w1", 1000, [makeSet({ weightKg: 0, reps: 10 })]),
			]),
		).toEqual({
			bestE1rm: undefined,
			heaviestWeight: undefined,
			bestVolume: undefined,
		});
	});
});
