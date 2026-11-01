import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { latestPendingTimer, markTimerReceived, WorkoutDB } from "./index";

let database: WorkoutDB;

beforeEach(async () => {
	database = new WorkoutDB(`test-${crypto.randomUUID()}`);
	await database.open();
});

afterEach(async () => {
	await database.delete();
});

describe("workout structure", () => {
	it("stores a workout with exercises and sets and reads them back in order", async () => {
		await database.exercises.add({
			id: "leg-press",
			name: "Seated Leg Press (Machine)",
			category: "legs",
			measure: "weight_reps",
			isAssisted: false,
			defaultRestSec: 60,
			archived: 0,
			createdAt: 0,
		});
		await database.workouts.add({
			id: "w1",
			name: "Leg Cardio And Abs",
			startedAt: Date.parse("2026-10-31T07:45:24+09:00"),
			source: "manual",
		});
		await database.workoutItems.add({
			id: "wi1",
			workoutId: "w1",
			exerciseId: "leg-press",
			order: 0,
		});
		await database.sets.bulkAdd([
			{
				id: "s2",
				workoutItemId: "wi1",
				index: 2,
				kind: "working",
				weightKg: 114,
				reps: 10,
			},
			{
				id: "s1",
				workoutItemId: "wi1",
				index: 1,
				kind: "working",
				weightKg: 114,
				reps: 10,
			},
		]);

		const sets = await database.sets
			.where("[workoutItemId+index]")
			.between(["wi1", 0], ["wi1", Infinity])
			.toArray();
		expect(sets.map((s) => s.index)).toEqual([1, 2]);
	});

	it("rejects two exercises with the same name", async () => {
		const base = {
			name: "Plank",
			category: "core" as const,
			measure: "time" as const,
			isAssisted: false,
			defaultRestSec: 60,
			archived: 0 as const,
			createdAt: 0,
		};
		await database.exercises.add({ id: "a", ...base });
		await expect(
			database.exercises.add({ id: "b", ...base }),
		).rejects.toThrow();
	});
});

describe("rest timers", () => {
	it("marks the newest pending timer as received", async () => {
		await database.restTimers.bulkAdd([
			{ id: "old", scheduledAt: 1_000, createdAt: 0, status: "pending" },
			{ id: "new", scheduledAt: 2_000, createdAt: 0, status: "pending" },
			{ id: "done", scheduledAt: 3_000, createdAt: 0, status: "cancelled" },
		]);

		expect((await latestPendingTimer(database))?.id).toBe("new");

		const received = await markTimerReceived(2_400, database);
		expect(received?.id).toBe("new");
		expect(await database.restTimers.get("new")).toMatchObject({
			status: "received",
			receivedAt: 2_400,
		});
	});

	it("returns undefined when nothing is pending", async () => {
		expect(await markTimerReceived(1, database)).toBeUndefined();
	});
});
