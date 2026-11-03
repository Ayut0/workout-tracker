import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_SETTINGS,
	findActiveWorkout,
	findLatestPendingTimer,
	findSettings,
	findWorkoutDetail,
	listExerciseHistory,
	listLibraryExercises,
	markTimerReceived,
	normalizeExerciseName,
	removeExercise,
	saveSettings,
	WorkoutDB,
} from "./index";
import type { Exercise, RestTimer } from "./types";
import { TIMER_STATUS } from "./types";

let database: WorkoutDB;

beforeEach(async () => {
	database = new WorkoutDB(`test-${crypto.randomUUID()}`);
	await database.open();
});

afterEach(async () => {
	await database.delete();
});

describe("rest timers", () => {
	it("marks the newest pending timer as received", async () => {
		await database.restTimers.bulkAdd([
			{
				id: "old",
				scheduledAt: 1_000,
				createdAt: 0,
				status: TIMER_STATUS.pending,
			},
			{
				id: "new",
				scheduledAt: 2_000,
				createdAt: 0,
				status: TIMER_STATUS.pending,
			},
			{
				id: "done",
				scheduledAt: 3_000,
				createdAt: 0,
				status: TIMER_STATUS.cancelled,
			},
		]);

		expect((await findLatestPendingTimer(database))?.id).toBe("new");

		const received = await markTimerReceived(2_400, database);
		expect(received?.id).toBe("new");
		expect(await database.restTimers.get("new")).toMatchObject({
			status: TIMER_STATUS.received,
			receivedAt: 2_400,
		});
	});

	it("returns undefined when nothing is pending", async () => {
		expect(await markTimerReceived(1, database)).toBeUndefined();
	});
});

describe("schema upgrade", () => {
	it("keeps version-1 rest timers when the database upgrades to version 2", async () => {
		const name = `test-${crypto.randomUUID()}`;
		const timer: RestTimer = {
			id: "t1",
			scheduledAt: 1_000,
			createdAt: 0,
			status: TIMER_STATUS.received,
			receivedAt: 1_200,
		};
		// A phone that only ever ran version 1: same name, version-1 schema only.
		const v1 = new Dexie(name);
		v1.version(1).stores({ restTimers: "id, scheduledAt, status" });
		await v1.table("restTimers").add(timer);
		v1.close();

		const upgraded = new WorkoutDB(name);
		await upgraded.open();
		try {
			expect(upgraded.verno).toBe(2);
			expect(await upgraded.restTimers.toArray()).toEqual([timer]);
			expect(await upgraded.exercises.count()).toBe(0);
		} finally {
			await upgraded.delete();
		}
	});
});

describe("exercises", () => {
	const exercise = (
		id: string,
		name: string,
		archivedAt?: number,
	): Exercise => ({
		id,
		name,
		nameKey: normalizeExerciseName(name),
		...(archivedAt === undefined ? {} : { archivedAt }),
	});

	it("normalises names for matching: case, outer and repeated spaces", () => {
		expect(normalizeExerciseName("  Bench   Press (Barbell) ")).toBe(
			"bench press (barbell)",
		);
	});

	it("rejects a second exercise whose name differs only by case or spacing", async () => {
		await database.exercises.add(exercise("a", "Squat"));
		await expect(
			database.exercises.add(exercise("b", " squat ")),
		).rejects.toThrow();
	});

	it("lists the library by name without archived exercises", async () => {
		await database.exercises.bulkAdd([
			exercise("s", "Squat"),
			exercise("b", "bench press"),
			exercise("o", "Old Row", 5),
		]);

		const names = (await listLibraryExercises(database)).map((e) => e.name);
		expect(names).toEqual(["bench press", "Squat"]);
	});

	it("deletes an exercise nothing refers to", async () => {
		await database.exercises.add(exercise("e", "Squat"));

		expect(await removeExercise("e", 7, database)).toBe("deleted");
		expect(await database.exercises.get("e")).toBeUndefined();
	});

	it("archives an exercise a workout refers to", async () => {
		await database.exercises.add(exercise("e", "Squat"));
		await database.workoutExercises.add({
			id: "we",
			workoutId: "w",
			exerciseId: "e",
			order: 0,
		});

		expect(await removeExercise("e", 7, database)).toBe("archived");
		expect(await database.exercises.get("e")).toMatchObject({ archivedAt: 7 });
	});

	it("archives an exercise a template refers to", async () => {
		await database.exercises.add(exercise("e", "Squat"));
		await database.templates.add({
			id: "t",
			name: "Legs",
			exercises: [{ exerciseId: "e", sets: [{ reps: 5 }] }],
		});

		expect(await removeExercise("e", 7, database)).toBe("archived");
	});
});

describe("workouts", () => {
	beforeEach(async () => {
		await database.workouts.bulkAdd([
			{ id: "w1", name: "Push", startedAt: 1_000, endedAt: 2_000 },
			{ id: "w2", name: "Legs", startedAt: 3_000, endedAt: 4_000 },
		]);
		// Stored out of order on purpose: reads must sort by `order`.
		await database.workoutExercises.bulkAdd([
			{ id: "w1-ohp", workoutId: "w1", exerciseId: "ohp", order: 1 },
			{ id: "w1-bench", workoutId: "w1", exerciseId: "bench", order: 0 },
			{ id: "w2-squat", workoutId: "w2", exerciseId: "squat", order: 0 },
			{ id: "w2-bench", workoutId: "w2", exerciseId: "bench", order: 1 },
		]);
		await database.sets.bulkAdd([
			{
				id: "s2",
				workoutExerciseId: "w1-bench",
				order: 1,
				weightKg: 62.5,
				reps: 5,
			},
			{
				id: "s1",
				workoutExerciseId: "w1-bench",
				order: 0,
				weightKg: 60,
				reps: 5,
			},
			{
				id: "s3",
				workoutExerciseId: "w1-ohp",
				order: 0,
				weightKg: 40,
				reps: 8,
			},
			{
				id: "s4",
				workoutExerciseId: "w2-bench",
				order: 0,
				weightKg: 65,
				reps: 3,
			},
			{
				id: "s5",
				workoutExerciseId: "w2-squat",
				order: 0,
				weightKg: 100,
				reps: 5,
			},
		]);
	});

	it("loads a workout with its exercises and sets in order", async () => {
		const detail = await findWorkoutDetail("w1", database);

		expect(detail?.workout.name).toBe("Push");
		expect(
			detail?.exercises.map((e) => [
				e.workoutExercise.exerciseId,
				e.sets.map((s) => s.id),
			]),
		).toEqual([
			["bench", ["s1", "s2"]],
			["ohp", ["s3"]],
		]);
	});

	it("returns undefined for a workout that does not exist", async () => {
		expect(await findWorkoutDetail("nope", database)).toBeUndefined();
	});

	it("lists one exercise's sets across workouts, oldest workout first", async () => {
		const history = await listExerciseHistory("bench", database);

		expect(history.map((h) => [h.workout.id, h.sets.map((s) => s.id)])).toEqual(
			[
				["w1", ["s1", "s2"]],
				["w2", ["s4"]],
			],
		);
	});

	it("finds the active workout only while the latest one has no end", async () => {
		expect(await findActiveWorkout(database)).toBeUndefined();

		await database.workouts.add({ id: "w3", name: "Pull", startedAt: 5_000 });
		expect((await findActiveWorkout(database))?.id).toBe("w3");
	});
});

describe("settings", () => {
	it("returns the defaults before anything is saved", async () => {
		expect(await findSettings(database)).toEqual(DEFAULT_SETTINGS);
	});

	it("saves a change and keeps the other settings", async () => {
		await saveSettings({ weightUnit: "lb" }, database);

		expect(await findSettings(database)).toEqual({
			...DEFAULT_SETTINGS,
			weightUnit: "lb",
		});
	});
});
