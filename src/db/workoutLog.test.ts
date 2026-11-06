import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WorkoutExerciseDetail } from "./index";
import { findActiveWorkout, findWorkoutDetail, WorkoutDB } from "./index";
import type { Workout, WorkoutSet } from "./types";
import {
	addSet,
	addWorkoutExercise,
	completeSet,
	deleteWorkout,
	findActiveWorkoutDetail,
	finishWorkout,
	moveItem,
	moveWorkoutExercise,
	planNextSet,
	removeSet,
	removeWorkoutExercise,
	startWorkout,
	uncompleteSet,
	updateSet,
	updateWorkout,
} from "./workoutLog";

let database: WorkoutDB;

beforeEach(async () => {
	database = new WorkoutDB(`test-${crypto.randomUUID()}`);
	await database.open();
	await database.exercises.bulkAdd([
		{ id: "bench", name: "Bench Press", nameKey: "bench press" },
		{ id: "squat", name: "Squat", nameKey: "squat", restSeconds: 180 },
		{ id: "row", name: "Row", nameKey: "row" },
	]);
});

afterEach(async () => {
	await database.delete();
});

async function startEmpty(startedAt = 1_000): Promise<Workout> {
	const result = await startWorkout({ name: "Push", startedAt }, database);
	if (!result.ok) throw new Error("expected a new workout");
	return result.workout;
}

function firstSet(entry: WorkoutExerciseDetail): WorkoutSet {
	const set = entry.sets[0];
	if (!set) throw new Error("expected a set");
	return set;
}

/** The workout's exercises and their sets' order, as [exerciseId, order[]]. */
async function readShape(workoutId: string) {
	const detail = await findWorkoutDetail(workoutId, database);
	return detail?.exercises.map((e) => [
		e.workoutExercise.exerciseId,
		e.workoutExercise.order,
		e.sets.map((s) => s.order),
	]);
}

describe("startWorkout", () => {
	it("starts an empty active workout", async () => {
		const workout = await startEmpty();

		expect(workout).toMatchObject({ name: "Push", startedAt: 1_000 });
		expect(workout.endedAt).toBeUndefined();
		expect((await findActiveWorkout(database))?.id).toBe(workout.id);
		expect(await readShape(workout.id)).toEqual([]);
	});

	it("does not start a second workout while one is active", async () => {
		const first = await startEmpty();

		const second = await startWorkout(
			{ name: "Legs", startedAt: 2_000 },
			database,
		);

		expect(second).toEqual({ ok: false, reason: "active", active: first });
		expect(await database.workouts.count()).toBe(1);
	});

	it("starts with planned exercises and sets, in order (templates)", async () => {
		const result = await startWorkout(
			{
				name: "Legs",
				startedAt: 1_000,
				exercises: [
					{ exerciseId: "squat", sets: [{ weightKg: 100, reps: 5 }, {}] },
					{ exerciseId: "row", sets: [] },
				],
			},
			database,
		);
		if (!result.ok) throw new Error("expected a new workout");

		const detail = await findWorkoutDetail(result.workout.id, database);
		expect(
			detail?.exercises.map((e) => [
				e.workoutExercise.exerciseId,
				e.sets.map((s) => [s.weightKg, s.reps, s.completedAt]),
			]),
		).toEqual([
			[
				"squat",
				[
					[100, 5, undefined],
					[undefined, undefined, undefined],
				],
			],
			["row", []],
		]);
	});

	it("can start again once the active workout is finished", async () => {
		const first = await startEmpty(1_000);
		await finishWorkout(first.id, 1_500, database);

		const second = await startWorkout(
			{ name: "Legs", startedAt: 2_000 },
			database,
		);

		expect(second.ok).toBe(true);
	});
});

describe("exercises in a workout", () => {
	it("adds exercises at the end, each with one empty set", async () => {
		const workout = await startEmpty();

		await addWorkoutExercise(workout.id, "bench", database);
		const added = await addWorkoutExercise(workout.id, "squat", database);

		expect(added?.sets).toHaveLength(1);
		expect(added?.sets[0]?.weightKg).toBeUndefined();
		expect(await readShape(workout.id)).toEqual([
			["bench", 0, [0]],
			["squat", 1, [0]],
		]);
	});

	it("adds nothing to a workout that does not exist", async () => {
		expect(await addWorkoutExercise("nope", "bench", database)).toBeUndefined();
		expect(await database.workoutExercises.count()).toBe(0);
	});

	it("removes an exercise with its sets and closes up the order", async () => {
		const workout = await startEmpty();
		await addWorkoutExercise(workout.id, "bench", database);
		const squat = await addWorkoutExercise(workout.id, "squat", database);
		await addWorkoutExercise(workout.id, "row", database);
		if (!squat) throw new Error("expected squat");

		expect(
			await removeWorkoutExercise(squat.workoutExercise.id, database),
		).toBe(true);

		expect(await readShape(workout.id)).toEqual([
			["bench", 0, [0]],
			["row", 1, [0]],
		]);
		expect(await database.sets.get(firstSet(squat).id)).toBeUndefined();
	});

	it("moves an exercise up and down, keeping order dense", async () => {
		const workout = await startEmpty();
		await addWorkoutExercise(workout.id, "bench", database);
		await addWorkoutExercise(workout.id, "squat", database);
		const row = await addWorkoutExercise(workout.id, "row", database);
		if (!row) throw new Error("expected row");

		await moveWorkoutExercise(row.workoutExercise.id, 0, database);
		expect((await readShape(workout.id))?.map((e) => e[0])).toEqual([
			"row",
			"bench",
			"squat",
		]);

		await moveWorkoutExercise(row.workoutExercise.id, 1, database);
		expect(await readShape(workout.id)).toEqual([
			["bench", 0, [0]],
			["row", 1, [0]],
			["squat", 2, [0]],
		]);
	});
});

describe("sets", () => {
	async function startWithBench() {
		const workout = await startEmpty();
		const bench = await addWorkoutExercise(workout.id, "bench", database);
		if (!bench) throw new Error("expected bench");
		return { workout, bench, firstSetId: firstSet(bench).id };
	}

	it("adds a set that starts with the previous set's weight and reps", async () => {
		const { bench, firstSetId } = await startWithBench();
		await updateSet(firstSetId, { weightKg: 60, reps: 8 }, database);
		await completeSet(firstSetId, 5_000, database);

		const next = await addSet(bench.workoutExercise.id, database);

		expect(next).toMatchObject({ order: 1, weightKg: 60, reps: 8 });
		expect(next?.completedAt).toBeUndefined();
	});

	it("edits a set's weight and reps and clears a field with undefined", async () => {
		const { firstSetId } = await startWithBench();

		await updateSet(firstSetId, { weightKg: 60, reps: 8 }, database);
		await updateSet(firstSetId, { weightKg: undefined }, database);

		const set = await database.sets.get(firstSetId);
		expect(set?.reps).toBe(8);
		expect(set && "weightKg" in set).toBe(false);
	});

	it("leaves fields that are not in the changes alone", async () => {
		const { firstSetId } = await startWithBench();
		await updateSet(firstSetId, { weightKg: 60, reps: 8 }, database);

		await updateSet(firstSetId, { reps: 6 }, database);

		expect(await database.sets.get(firstSetId)).toMatchObject({
			weightKg: 60,
			reps: 6,
		});
	});

	it("removes a set and closes up the order", async () => {
		const { workout, bench, firstSetId } = await startWithBench();
		await addSet(bench.workoutExercise.id, database);
		await addSet(bench.workoutExercise.id, database);

		await removeSet(firstSetId, database);

		expect(await readShape(workout.id)).toEqual([["bench", 0, [0, 1]]]);
	});

	it("completes a set and returns it with its exercise for the rest timer", async () => {
		const workout = await startEmpty();
		const squat = await addWorkoutExercise(workout.id, "squat", database);
		if (!squat) throw new Error("expected squat");

		const completed = await completeSet(firstSet(squat).id, 7_000, database);

		expect(completed?.set.completedAt).toBe(7_000);
		expect(completed?.workoutExercise.id).toBe(squat.workoutExercise.id);
		expect(completed?.exercise?.restSeconds).toBe(180);
		expect((await database.sets.get(firstSet(squat).id))?.completedAt).toBe(
			7_000,
		);
	});

	it("uncompletes a set", async () => {
		const { firstSetId } = await startWithBench();
		await completeSet(firstSetId, 7_000, database);

		await uncompleteSet(firstSetId, database);

		const set = await database.sets.get(firstSetId);
		expect(set && "completedAt" in set).toBe(false);
	});

	it("reports a missing set", async () => {
		expect(await completeSet("nope", 1, database)).toBeUndefined();
		expect(await updateSet("nope", { reps: 1 }, database)).toBe(false);
		expect(await removeSet("nope", database)).toBe(false);
	});
});

describe("finishing and discarding", () => {
	it("updates the name and notes; a blank name is kept, blank notes cleared", async () => {
		const workout = await startEmpty();

		await updateWorkout(
			workout.id,
			{ name: "  Heavy push ", notes: "Felt good" },
			database,
		);
		await updateWorkout(workout.id, { name: "   " }, database);
		expect(await database.workouts.get(workout.id)).toMatchObject({
			name: "Heavy push",
			notes: "Felt good",
		});

		await updateWorkout(workout.id, { notes: " " }, database);
		const updated = await database.workouts.get(workout.id);
		expect(updated && "notes" in updated).toBe(false);
	});

	it("finishes the workout: it ends and is stored with its exercises and sets in order", async () => {
		const workout = await startEmpty();
		const bench = await addWorkoutExercise(workout.id, "bench", database);
		await addWorkoutExercise(workout.id, "squat", database);
		if (!bench) throw new Error("expected bench");
		await addSet(bench.workoutExercise.id, database);

		const finished = await finishWorkout(workout.id, 9_000, database);

		expect(finished?.endedAt).toBe(9_000);
		expect(await findActiveWorkout(database)).toBeUndefined();
		expect(await findActiveWorkoutDetail(database)).toBeUndefined();
		expect(await readShape(workout.id)).toEqual([
			["bench", 0, [0, 1]],
			["squat", 1, [0]],
		]);
	});

	it("does not finish a workout twice", async () => {
		const workout = await startEmpty();
		await finishWorkout(workout.id, 9_000, database);

		expect(await finishWorkout(workout.id, 10_000, database)).toBeUndefined();
		expect((await database.workouts.get(workout.id))?.endedAt).toBe(9_000);
	});

	it("discards a workout with all its exercises and sets", async () => {
		const kept = await startEmpty(500);
		await addWorkoutExercise(kept.id, "row", database);
		await finishWorkout(kept.id, 600, database);
		const workout = await startEmpty(1_000);
		const bench = await addWorkoutExercise(workout.id, "bench", database);
		if (!bench) throw new Error("expected bench");
		await addSet(bench.workoutExercise.id, database);

		expect(await deleteWorkout(workout.id, database)).toBe(true);

		expect(await database.workouts.get(workout.id)).toBeUndefined();
		expect(await database.workoutExercises.count()).toBe(1);
		expect(await database.sets.count()).toBe(1);
		expect(await findActiveWorkout(database)).toBeUndefined();
		expect(await readShape(kept.id)).toEqual([["row", 0, [0]]]);
	});

	it("reports discarding a workout that does not exist", async () => {
		expect(await deleteWorkout("nope", database)).toBe(false);
	});
});

describe("resuming", () => {
	it("reads the active workout back from a fresh connection with all entered sets", async () => {
		const workout = await startEmpty();
		const bench = await addWorkoutExercise(workout.id, "bench", database);
		if (!bench) throw new Error("expected bench");
		await updateSet(firstSet(bench).id, { weightKg: 60, reps: 8 }, database);
		await completeSet(firstSet(bench).id, 2_000, database);
		await addSet(bench.workoutExercise.id, database);
		database.close();

		// A new connection stands in for the app being killed and reopened.
		const reopened = new WorkoutDB(database.name);
		await reopened.open();
		const detail = await findActiveWorkoutDetail(reopened);
		reopened.close();
		await database.open();

		expect(detail?.workout.id).toBe(workout.id);
		expect(
			detail?.exercises[0]?.sets.map((s) => [
				s.weightKg,
				s.reps,
				s.completedAt,
			]),
		).toEqual([
			[60, 8, 2_000],
			[60, 8, undefined],
		]);
	});
});

describe("planNextSet", () => {
	it("copies only weight and reps", () => {
		const last: WorkoutSet = {
			id: "s",
			workoutExerciseId: "we",
			order: 0,
			weightKg: 50,
			reps: 10,
			rpe: 8,
			completedAt: 1,
		};
		expect(planNextSet(last)).toEqual({ weightKg: 50, reps: 10 });
	});

	it("starts empty when there is no previous set", () => {
		expect(planNextSet(undefined)).toEqual({});
	});
});

describe("moveItem", () => {
	it("moves an item and shifts the rest", () => {
		expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
		expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
	});

	it("clamps the target and ignores an unknown source", () => {
		expect(moveItem(["a", "b", "c"], 1, 99)).toEqual(["a", "c", "b"]);
		expect(moveItem(["a", "b", "c"], 1, -5)).toEqual(["b", "a", "c"]);
		expect(moveItem(["a", "b"], -1, 0)).toEqual(["a", "b"]);
	});
});
