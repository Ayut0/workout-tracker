import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkoutDB } from "./index";
import { readRestWatch } from "./restWatch";
import {
	addSet,
	addWorkoutExercise,
	completeSet,
	finishWorkout,
	removeSet,
	startWorkout,
	uncompleteSet,
} from "./workoutLog";

let database: WorkoutDB;

beforeEach(async () => {
	database = new WorkoutDB(`test-${crypto.randomUUID()}`);
	await database.open();
	await database.exercises.add({
		id: "bench",
		name: "Bench Press",
		nameKey: "bench press",
	});
});

afterEach(async () => {
	await database.delete();
});

async function startWithSet() {
	const result = await startWorkout({ name: "Push", startedAt: 1 }, database);
	if (!result.ok) throw new Error("expected a new workout");
	const workoutExercise = await addWorkoutExercise(
		result.workout.id,
		"bench",
		database,
	);
	if (!workoutExercise) throw new Error("expected an exercise");
	const set = await addSet(workoutExercise.workoutExercise.id, database);
	if (!set) throw new Error("expected a set");
	return { workoutId: result.workout.id, setId: set.id };
}

describe("readRestWatch", () => {
	it("has no active workout when none is in progress", async () => {
		expect(await readRestWatch(undefined, database)).toEqual({
			activeWorkoutId: null,
		});
	});

	it("follows the rest's set as it is completed, uncompleted and removed", async () => {
		const { workoutId, setId } = await startWithSet();
		await completeSet(setId, 2, database);
		expect(await readRestWatch(setId, database)).toEqual({
			activeWorkoutId: workoutId,
			set: { id: setId, done: true },
		});

		await uncompleteSet(setId, database);
		expect((await readRestWatch(setId, database)).set?.done).toBe(false);

		await removeSet(setId, database);
		expect((await readRestWatch(setId, database)).set?.done).toBe(false);
	});

	it("has no active workout once it is finished", async () => {
		const { workoutId, setId } = await startWithSet();
		await finishWorkout(workoutId, 3, database);
		expect((await readRestWatch(setId, database)).activeWorkoutId).toBeNull();
	});
});
