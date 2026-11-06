import { describe, expect, it } from "vitest";
import type { WorkoutSet } from "../db/types";
import { findPersonalRecords, type ProgressPoint } from "./metrics";
import {
	buildMetricSeries,
	type FinishedHistoryInput,
	formatMetricValue,
	formatVolume,
	summarizeProgress,
} from "./progress";
import { KG_PER_LB } from "./units";

const DAY = 86_400_000;

function makeSet(weightKg: number, reps: number): WorkoutSet {
	return {
		id: crypto.randomUUID(),
		workoutExerciseId: "we",
		order: 0,
		weightKg,
		reps,
		completedAt: 1,
	};
}

function makeEntry(
	id: string,
	startedAt: number,
	sets: WorkoutSet[],
	{ active = false } = {},
): FinishedHistoryInput {
	const workout = active
		? { id, startedAt }
		: { id, startedAt, endedAt: startedAt + 3_600_000 };
	return { workout, sets };
}

function makePoint(fields: Partial<ProgressPoint>): ProgressPoint {
	return {
		workoutId: "w",
		date: 0,
		bestE1rmKg: undefined,
		volumeKg: 0,
		maxWeightKg: undefined,
		...fields,
	};
}

describe("summarizeProgress", () => {
	it("leaves out the workout still in progress", () => {
		const history = [
			makeEntry("w1", DAY, [makeSet(100, 5)]),
			makeEntry("active", 2 * DAY, [makeSet(150, 1)], { active: true }),
		];

		const { points, records } = summarizeProgress(history);

		expect(points.map((p) => p.workoutId)).toEqual(["w1"]);
		expect(records.heaviestWeight?.kg).toBe(100);
	});

	it("matches the metrics helpers for finished workouts", () => {
		const history = [
			makeEntry("w1", DAY, [makeSet(100, 5), makeSet(105, 3)]),
			makeEntry("w2", 2 * DAY, [makeSet(110, 2)]),
		];

		const { records } = summarizeProgress(history);

		expect(records).toEqual(findPersonalRecords(history));
	});
});

describe("buildMetricSeries", () => {
	const points = [
		makePoint({ workoutId: "a", date: 1, bestE1rmKg: 100, volumeKg: 500 }),
		makePoint({ workoutId: "bw", date: 2, volumeKg: 0 }),
		makePoint({ workoutId: "c", date: 3, bestE1rmKg: 110, volumeKg: 600 }),
	];

	it("plots the Estimated 1RM in kg, skipping workouts without one", () => {
		expect(buildMetricSeries(points, "e1rm", "kg")).toEqual([
			{ workoutId: "a", date: 1, value: 100 },
			{ workoutId: "c", date: 3, value: 110 },
		]);
	});

	it("plots Volume, skipping bodyweight-only workouts", () => {
		expect(
			buildMetricSeries(points, "volume", "kg").map((d) => d.value),
		).toEqual([500, 600]);
	});

	it("converts to pounds without rounding", () => {
		const [first] = buildMetricSeries(points, "e1rm", "lb");

		expect(first?.value).toBe(100 / KG_PER_LB);
	});
});

describe("formatMetricValue", () => {
	it("shows an Estimated 1RM to one decimal place", () => {
		expect(formatMetricValue(116.6667, "e1rm", "kg")).toBe("116.7 kg");
	});

	it("shows Volume as a whole number with grouping", () => {
		expect(formatMetricValue(12345.6, "volume", "lb")).toBe("12,346 lb");
	});

	it("shows a stored Volume in the chosen unit", () => {
		expect(formatVolume(1000, "kg")).toBe("1,000 kg");
		expect(formatVolume(1000, "lb")).toBe("2,205 lb");
	});
});
