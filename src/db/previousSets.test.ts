import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkoutDB } from "./index";
import { listPreviousSets } from "./previousSets";
import { importStrongWorkouts } from "./strongImport";
import type { WorkoutSet } from "./types";

let database: WorkoutDB;

beforeEach(async () => {
	database = new WorkoutDB(`test-${crypto.randomUUID()}`);
	await database.open();
	await database.exercises.bulkAdd([
		{ id: "bench", name: "Bench Press", nameKey: "bench press" },
		{ id: "squat", name: "Squat", nameKey: "squat" },
	]);
});

afterEach(async () => {
	await database.delete();
});

type SeedSet = Pick<
	WorkoutSet,
	"weightKg" | "reps" | "warmup" | "repMin" | "repMax"
> & { done?: boolean };

/** Stores a workout with the given exercises (in order) and their sets. */
async function seedWorkout(
	id: string,
	startedAt: number,
	ended: boolean,
	exercises: [exerciseId: string, sets: SeedSet[]][],
): Promise<void> {
	await database.workouts.add({
		id,
		name: id,
		startedAt,
		...(ended ? { endedAt: startedAt + 3_600_000 } : {}),
	});
	for (const [order, [exerciseId, sets]] of exercises.entries()) {
		const workoutExerciseId = `${id}-${order}`;
		await database.workoutExercises.add({
			id: workoutExerciseId,
			workoutId: id,
			exerciseId,
			order,
		});
		// Added in reverse so the result's order comes from `order`, not insertion.
		for (const [setOrder, { done = true, ...measured }] of [
			...sets.entries(),
		].reverse()) {
			await database.sets.add({
				id: `${workoutExerciseId}-${setOrder}`,
				workoutExerciseId,
				order: setOrder,
				...measured,
				...(done ? { completedAt: startedAt + setOrder } : {}),
			});
		}
	}
}

function getMeasurements(sets: WorkoutSet[]) {
	return sets.map(({ weightKg, reps }) => ({ weightKg, reps }));
}

describe("listPreviousSets", () => {
	it("is empty for an exercise never performed", async () => {
		expect(await listPreviousSets("bench", database)).toEqual([]);
	});

	it("returns the sets, in order, of the latest finished workout with the exercise", async () => {
		await seedWorkout("old", 1_000, true, [
			["bench", [{ weightKg: 80, reps: 8 }]],
		]);
		await seedWorkout("latest", 3_000, true, [
			[
				"bench",
				[
					{ weightKg: 100, reps: 5 },
					{ weightKg: 102.5, reps: 3 },
				],
			],
		]);
		await seedWorkout("other", 4_000, true, [
			["squat", [{ weightKg: 140, reps: 5 }]],
		]);

		expect(getMeasurements(await listPreviousSets("bench", database))).toEqual([
			{ weightKg: 100, reps: 5 },
			{ weightKg: 102.5, reps: 3 },
		]);
	});

	it("ignores the active workout", async () => {
		await seedWorkout("finished", 1_000, true, [
			["bench", [{ weightKg: 90, reps: 6 }]],
		]);
		await seedWorkout("active", 2_000, false, [
			["bench", [{ weightKg: 120, reps: 1 }]],
		]);

		expect(getMeasurements(await listPreviousSets("bench", database))).toEqual([
			{ weightKg: 90, reps: 6 },
		]);
	});

	it("leaves out incomplete sets, and skips a workout where none was done", async () => {
		await seedWorkout("done", 1_000, true, [
			[
				"bench",
				[
					{ weightKg: 90, reps: 6 },
					{ weightKg: 95, reps: 4, done: false },
					{ weightKg: 92.5, reps: 5 },
				],
			],
		]);
		await seedWorkout("skipped", 2_000, true, [
			["bench", [{ weightKg: 200, reps: 1, done: false }]],
		]);

		expect(getMeasurements(await listPreviousSets("bench", database))).toEqual([
			{ weightKg: 90, reps: 6 },
			{ weightKg: 92.5, reps: 5 },
		]);
	});

	it("joins two appearances in the same workout in workout order", async () => {
		await seedWorkout("twice", 1_000, true, [
			["bench", [{ weightKg: 100, reps: 5 }]],
			["squat", [{ weightKg: 140, reps: 5 }]],
			[
				"bench",
				[
					{ weightKg: 70, reps: 12 },
					{ weightKg: 70, reps: 10 },
				],
			],
		]);

		expect(getMeasurements(await listPreviousSets("bench", database))).toEqual([
			{ weightKg: 100, reps: 5 },
			{ weightKg: 70, reps: 12 },
			{ weightKg: 70, reps: 10 },
		]);
	});

	it("keeps each set's warm-up mark and planned rep range, for Progression (#71)", async () => {
		await seedWorkout("planned", 1_000, true, [
			[
				"bench",
				[
					{ weightKg: 60, reps: 8, warmup: true },
					{ weightKg: 100, reps: 6, repMin: 4, repMax: 6 },
				],
			],
		]);

		const sets = await listPreviousSets("bench", database);

		expect(
			sets.map(({ weightKg, reps, warmup, repMin, repMax }) => ({
				weightKg,
				reps,
				warmup,
				repMin,
				repMax,
			})),
		).toEqual([
			{ weightKg: 60, reps: 8, warmup: true },
			{ weightKg: 100, reps: 6, repMin: 4, repMax: 6 },
		]);
	});

	it("works for imported Strong history", async () => {
		await importStrongWorkouts(
			[
				{
					name: "Imported push",
					startedAt: 5_000,
					endedAt: 9_000,
					exercises: [
						{
							name: "Bench Press",
							sets: [
								{ weightKg: 60, reps: 10 },
								{ weightKg: 62.5, reps: 8 },
							],
						},
					],
				},
			],
			database,
		);

		expect(getMeasurements(await listPreviousSets("bench", database))).toEqual([
			{ weightKg: 60, reps: 10 },
			{ weightKg: 62.5, reps: 8 },
		]);
	});
});
