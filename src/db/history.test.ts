import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type HistoryCursor,
	listWorkoutHistory,
	rescheduleWorkout,
} from "./history";
import { findWorkoutDetail, WorkoutDB } from "./index";
import type { Workout } from "./types";
import {
	addSet,
	addWorkoutExercise,
	completeSet,
	deleteWorkout,
	removeSet,
	removeWorkoutExercise,
	startWorkout,
	updateSet,
	updateWorkout,
} from "./workoutLog";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

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

/** Stores a finished workout with one exercise and one complete set. */
async function addFinished(
	id: string,
	startedAt: number,
	durationMs = HOUR,
): Promise<Workout> {
	const workout: Workout = {
		id,
		name: `Workout ${id}`,
		startedAt,
		endedAt: startedAt + durationMs,
	};
	await database.workouts.add(workout);
	await database.workoutExercises.add({
		id: `${id}-we`,
		workoutId: id,
		exerciseId: "bench",
		order: 0,
	});
	await database.sets.add({
		id: `${id}-set`,
		workoutExerciseId: `${id}-we`,
		order: 0,
		weightKg: 100,
		reps: 5,
		completedAt: startedAt + durationMs / 2,
	});
	return workout;
}

/** Reads every page, returning the workout ids page by page. */
async function readAllPages(limit: number): Promise<string[][]> {
	const pages: string[][] = [];
	let after: HistoryCursor | undefined;
	do {
		const page = await listWorkoutHistory({ after, limit }, database);
		pages.push(page.entries.map((entry) => entry.workout.id));
		after = page.next;
	} while (after !== undefined);
	return pages;
}

describe("listWorkoutHistory", () => {
	it("lists finished workouts newest first, leaving out the active one", async () => {
		await addFinished("old", 1 * DAY);
		await addFinished("new", 3 * DAY);
		await addFinished("mid", 2 * DAY);
		await database.workouts.add({
			id: "active",
			name: "Now",
			startedAt: 4 * DAY,
		});

		const page = await listWorkoutHistory({}, database);

		expect(page.entries.map((e) => e.workout.id)).toEqual([
			"new",
			"mid",
			"old",
		]);
		expect(page.next).toBeUndefined();
	});

	it("pages through every workout exactly once, in order", async () => {
		for (let day = 1; day <= 7; day++) await addFinished(`d${day}`, day * DAY);

		expect(await readAllPages(3)).toEqual([
			["d7", "d6", "d5"],
			["d4", "d3", "d2"],
			["d1"],
		]);
	});

	it("has no next page when the last page is exactly full", async () => {
		for (let day = 1; day <= 4; day++) await addFinished(`d${day}`, day * DAY);

		expect(await readAllPages(2)).toEqual([
			["d4", "d3"],
			["d2", "d1"],
		]);
	});

	it("neither skips nor repeats workouts that start at the same moment", async () => {
		for (const id of ["a", "b", "c", "d", "e"]) await addFinished(id, DAY);
		await addFinished("later", 2 * DAY);

		const pages = await readAllPages(2);

		expect(pages).toEqual([
			["later", "e"],
			["d", "c"],
			["b", "a"],
		]);
	});

	it("skips active workouts without shortening a page", async () => {
		await addFinished("a", 1 * DAY);
		await database.workouts.add({ id: "x", name: "Open", startedAt: 2 * DAY });
		await addFinished("b", 3 * DAY);
		await addFinished("c", 4 * DAY);

		expect(await readAllPages(2)).toEqual([["c", "b"], ["a"]]);
	});

	it("carries each workout's exercises and sets in order, with library names", async () => {
		await database.workouts.add({
			id: "w",
			name: "Legs",
			startedAt: DAY,
			endedAt: DAY + HOUR,
		});
		await database.workoutExercises.bulkAdd([
			{ id: "we-squat", workoutId: "w", exerciseId: "squat", order: 1 },
			{ id: "we-bench", workoutId: "w", exerciseId: "bench", order: 0 },
			{ id: "we-gone", workoutId: "w", exerciseId: "deleted", order: 2 },
		]);
		await database.sets.bulkAdd([
			{ id: "s2", workoutExerciseId: "we-squat", order: 1, reps: 3 },
			{ id: "s1", workoutExerciseId: "we-squat", order: 0, reps: 5 },
			{ id: "s3", workoutExerciseId: "we-bench", order: 0, reps: 8 },
		]);

		const [entry] = (await listWorkoutHistory({}, database)).entries;

		expect(
			entry?.exercises.map((e) => [
				e.exercise?.name,
				e.sets.map((set) => set.id),
			]),
		).toEqual([
			["Bench Press", ["s3"]],
			["Squat", ["s1", "s2"]],
			[undefined, []],
		]);
	});

	it("returns an empty page when there is no history", async () => {
		expect(await listWorkoutHistory({}, database)).toEqual({
			entries: [],
			next: undefined,
		});
	});
});

describe("rescheduleWorkout", () => {
	const NOW = 10 * DAY;

	it("moves the start, and the end and set done times with it", async () => {
		await addFinished("w", 2 * DAY, HOUR);

		const result = await rescheduleWorkout("w", 1 * DAY, NOW, database);

		expect(result).toEqual({
			ok: true,
			workout: {
				id: "w",
				name: "Workout w",
				startedAt: 1 * DAY,
				endedAt: 1 * DAY + HOUR,
			},
		});
		const set = await database.sets.get("w-set");
		expect(set?.completedAt).toBe(1 * DAY + HOUR / 2);
	});

	it("leaves sets that are not done without a done time", async () => {
		await addFinished("w", 2 * DAY);
		await database.sets.add({
			id: "open",
			workoutExerciseId: "w-we",
			order: 1,
			reps: 5,
		});

		await rescheduleWorkout("w", 3 * DAY, NOW, database);

		expect((await database.sets.get("open"))?.completedAt).toBeUndefined();
	});

	it("leaves other workouts' sets alone", async () => {
		await addFinished("w", 2 * DAY);
		await addFinished("other", 5 * DAY);

		await rescheduleWorkout("w", 1 * DAY, NOW, database);

		expect((await database.sets.get("other-set"))?.completedAt).toBe(
			5 * DAY + HOUR / 2,
		);
		expect((await database.workouts.get("other"))?.startedAt).toBe(5 * DAY);
	});

	it("refuses a start in the future", async () => {
		await addFinished("w", 2 * DAY);

		expect(await rescheduleWorkout("w", NOW + 1, NOW, database)).toEqual({
			ok: false,
			reason: "future",
		});
		expect((await database.workouts.get("w"))?.startedAt).toBe(2 * DAY);
	});

	it("refuses a start at or after the active workout's, which would hide it", async () => {
		await addFinished("w", 2 * DAY);
		await database.workouts.add({
			id: "active",
			name: "Now",
			startedAt: NOW - HOUR,
		});

		expect(await rescheduleWorkout("w", NOW - HOUR, NOW, database)).toEqual({
			ok: false,
			reason: "after-active",
		});
		expect(
			(await rescheduleWorkout("w", NOW - 2 * HOUR, NOW, database)).ok,
		).toBe(true);
	});

	it("reports a workout that does not exist", async () => {
		expect(await rescheduleWorkout("nope", DAY, NOW, database)).toEqual({
			ok: false,
			reason: "not-found",
		});
	});
});

describe("editing a finished workout", () => {
	async function finishedWorkout(): Promise<Workout> {
		const started = await startWorkout(
			{
				name: "Push",
				startedAt: DAY,
				exercises: [{ exerciseId: "bench", sets: [{ weightKg: 80, reps: 8 }] }],
			},
			database,
		);
		if (!started.ok) throw new Error("expected a new workout");
		await database.workouts.update(started.workout.id, { endedAt: DAY + HOUR });
		const finished = await database.workouts.get(started.workout.id);
		if (!finished) throw new Error("expected the workout");
		return finished;
	}

	async function readDetail(id: string) {
		const detail = await findWorkoutDetail(id, database);
		if (!detail) throw new Error("expected the workout");
		return detail;
	}

	it("changes name and notes and keeps it finished", async () => {
		const workout = await finishedWorkout();

		await updateWorkout(
			workout.id,
			{ name: "Chest", notes: "Felt strong" },
			database,
		);

		expect(await database.workouts.get(workout.id)).toEqual({
			...workout,
			name: "Chest",
			notes: "Felt strong",
		});
	});

	it("edits, adds, completes and removes sets and exercises", async () => {
		const workout = await finishedWorkout();
		const bench = (await readDetail(workout.id)).exercises[0];
		const firstSet = bench?.sets[0];
		if (!bench || !firstSet) throw new Error("expected a set");

		await updateSet(firstSet.id, { weightKg: 82.5, reps: 6 }, database);
		const added = await addSet(bench.workoutExercise.id, database);
		if (!added) throw new Error("expected a set");
		await completeSet(added.id, DAY + HOUR, database);
		await removeSet(firstSet.id, database);
		const squat = await addWorkoutExercise(workout.id, "squat", database);
		if (!squat) throw new Error("expected an exercise");

		const detail = await readDetail(workout.id);
		expect(
			detail.exercises.map((e) => [
				e.workoutExercise.exerciseId,
				e.sets.map((s) => [s.order, s.weightKg, s.reps, s.completedAt]),
			]),
		).toEqual([
			["bench", [[0, 82.5, 6, DAY + HOUR]]],
			["squat", [[0, undefined, undefined, undefined]]],
		]);

		await removeWorkoutExercise(squat.workoutExercise.id, database);
		expect((await readDetail(workout.id)).exercises).toHaveLength(1);
		expect((await database.workouts.get(workout.id))?.endedAt).toBe(DAY + HOUR);
	});

	it("shows the edits in History", async () => {
		const workout = await finishedWorkout();
		await updateWorkout(workout.id, { name: "Renamed" }, database);

		const [entry] = (await listWorkoutHistory({}, database)).entries;

		expect(entry?.workout.name).toBe("Renamed");
	});
});

describe("deleting a finished workout", () => {
	it("removes it with its exercises and sets, and nothing else", async () => {
		await addFinished("gone", 1 * DAY);
		await addFinished("kept", 2 * DAY);

		expect(await deleteWorkout("gone", database)).toBe(true);

		expect(await database.workouts.get("gone")).toBeUndefined();
		expect(
			await database.workoutExercises.where("workoutId").equals("gone").count(),
		).toBe(0);
		expect(await database.sets.get("gone-set")).toBeUndefined();
		expect(await database.sets.get("kept-set")).toBeDefined();
		expect(await database.exercises.get("bench")).toBeDefined();
		const page = await listWorkoutHistory({}, database);
		expect(page.entries.map((e) => e.workout.id)).toEqual(["kept"]);
	});

	it("reports a workout that is already gone", async () => {
		expect(await deleteWorkout("nope", database)).toBe(false);
	});
});
