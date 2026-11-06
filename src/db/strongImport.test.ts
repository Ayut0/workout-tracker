import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sample from "../../fixtures/strong-sample.csv?raw";
import {
	countSets,
	PARSE_KIND,
	parseStrongCsv,
	type StrongWorkout,
} from "../lib/strongCsv";
import {
	createExercise,
	findWorkoutDetail,
	removeExercise,
	WorkoutDB,
} from "./index";
import {
	importStrongWorkouts,
	planStrongImport,
	previewStrongImport,
	toWorkoutImportKey,
} from "./strongImport";

let database: WorkoutDB;

beforeEach(async () => {
	database = new WorkoutDB(`test-${crypto.randomUUID()}`);
	await database.open();
});

afterEach(async () => {
	vi.restoreAllMocks();
	await database.delete();
});

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

function makeWorkout(
	name: string,
	startedAt: number,
	exercises: StrongWorkout["exercises"] = [
		{ name: "Bench Press (Barbell)", sets: [{ weightKg: 80, reps: 5 }] },
	],
): StrongWorkout {
	return { name, startedAt, endedAt: startedAt + 60 * MINUTE_MS, exercises };
}

function parseSample(): { workouts: StrongWorkout[] } {
	const result = parseStrongCsv(sample, {
		weightUnit: "kg",
		distanceUnit: "km",
	});
	if (result.kind !== PARSE_KIND.parsed) throw new Error(result.kind);
	return { workouts: result.workouts };
}

async function countRecords() {
	return {
		exercises: await database.exercises.count(),
		workouts: await database.workouts.count(),
		workoutExercises: await database.workoutExercises.count(),
		sets: await database.sets.count(),
	};
}

describe("toWorkoutImportKey", () => {
	it("ignores case and spacing in the workout name", () => {
		expect(toWorkoutImportKey(1_000, "  Push   Day ")).toBe(
			toWorkoutImportKey(1_000, "push day"),
		);
		expect(toWorkoutImportKey(1_000, "Push Day")).not.toBe(
			toWorkoutImportKey(2_000, "Push Day"),
		);
	});
});

describe("planStrongImport", () => {
	const push = makeWorkout("Push Day", 3 * DAY_MS, [
		{ name: "Bench Press (Barbell)", sets: [{ weightKg: 80, reps: 5 }] },
		{ name: "Overhead  Press", sets: [{ weightKg: 40, reps: 8 }, {}] },
	]);
	const legs = makeWorkout("Legs", DAY_MS, [
		{ name: "squat", sets: [{ weightKg: 100, reps: 5 }] },
		{ name: "Overhead Press", sets: [{ weightKg: 40, reps: 8 }] },
	]);

	it("lists new workouts, their date range, sets and new exercises", () => {
		const plan = planStrongImport([push, legs], [{ line: 9, reason: "x" }], {
			exerciseNameKeys: new Set(["bench press (barbell)"]),
			workoutKeys: new Set(),
		});

		expect(plan.workouts).toEqual([push, legs]);
		expect(plan.duplicateCount).toBe(0);
		expect(plan.setCount).toBe(5);
		expect(plan.firstStartedAt).toBe(DAY_MS);
		expect(plan.lastStartedAt).toBe(3 * DAY_MS);
		// First spelling in the file wins; matching ignores case and spacing.
		expect(plan.newExerciseNames).toEqual(["Overhead Press", "squat"]);
		expect(plan.skipped).toEqual([{ line: 9, reason: "x" }]);
	});

	it("skips workouts already in the database", () => {
		const plan = planStrongImport([push, legs], [], {
			exerciseNameKeys: new Set(),
			workoutKeys: new Set([toWorkoutImportKey(push.startedAt, "push day")]),
		});

		expect(plan.workouts).toEqual([legs]);
		expect(plan.duplicateCount).toBe(1);
		expect(plan.setCount).toBe(2);
		expect(plan.firstStartedAt).toBe(DAY_MS);
		expect(plan.lastStartedAt).toBe(DAY_MS);
		// Exercises only in skipped workouts are not created.
		expect(plan.newExerciseNames).toEqual(["squat", "Overhead Press"]);
	});

	it("has no date range when nothing is new", () => {
		const plan = planStrongImport([push], [], {
			exerciseNameKeys: new Set(),
			workoutKeys: new Set([toWorkoutImportKey(push.startedAt, push.name)]),
		});

		expect(plan.workouts).toEqual([]);
		expect(plan.firstStartedAt).toBeUndefined();
		expect(plan.lastStartedAt).toBeUndefined();
		expect(plan.newExerciseNames).toEqual([]);
	});
});

describe("importStrongWorkouts", () => {
	it("stores workouts, exercises and complete sets in order", async () => {
		const { workouts } = parseSample();

		const result = await importStrongWorkouts(workouts, database);

		expect(result).toEqual({
			workoutsAdded: 3,
			duplicateCount: 0,
			exercisesCreated: 6,
			setsAdded: countSets(workouts),
		});
		const counts = await countRecords();
		expect(counts).toEqual({
			exercises: 6,
			workouts: 3,
			workoutExercises: 7,
			sets: countSets(workouts),
		});

		const push = await database.workouts
			.where("startedAt")
			.equals(workouts[0]?.startedAt ?? 0)
			.first();
		expect(push).toMatchObject({
			name: "Push Day",
			endedAt: workouts[0]?.endedAt,
			notes: "Felt strong, slept well",
		});
		const detail = await findWorkoutDetail(push?.id ?? "", database);
		const bench = await database.exercises.get({
			nameKey: "bench press (barbell)",
		});
		expect(detail?.exercises[0]?.workoutExercise).toMatchObject({
			exerciseId: bench?.id,
			order: 0,
		});
		expect(
			detail?.exercises[0]?.sets.map((s) => [s.order, s.weightKg, s.reps]),
		).toEqual([
			[0, 40, 10],
			[1, 80, 5],
			[2, 80, 5],
			[3, 60, 8],
		]);
		// Strong only exports done sets: each is complete, done when the workout ended.
		for (const set of detail?.exercises.flatMap((e) => e.sets) ?? []) {
			expect(set.completedAt).toBe(workouts[0]?.endedAt);
		}
	});

	it("is a no-op when the same file is imported again", async () => {
		const { workouts } = parseSample();
		await importStrongWorkouts(workouts, database);
		const before = await countRecords();
		const storedWorkouts = await database.workouts.toArray();
		const storedSets = await database.sets.toArray();

		const again = await importStrongWorkouts(parseSample().workouts, database);

		expect(again).toEqual({
			workoutsAdded: 0,
			duplicateCount: 3,
			exercisesCreated: 0,
			setsAdded: 0,
		});
		expect(await countRecords()).toEqual(before);
		expect(await database.workouts.toArray()).toEqual(storedWorkouts);
		expect(await database.sets.toArray()).toEqual(storedSets);
	});

	it("keeps workouts already in the database intact", async () => {
		const own = makeWorkout("Morning lift", 5 * DAY_MS);
		await database.workouts.add({
			id: "own-workout",
			name: own.name,
			startedAt: own.startedAt,
			endedAt: own.endedAt,
			notes: "logged in the app",
		});
		await database.exercises.add({
			id: "own-bench",
			name: "Bench Press (Barbell)",
			nameKey: "bench press (barbell)",
			restSeconds: 120,
		});
		await database.workoutExercises.add({
			id: "own-we",
			workoutId: "own-workout",
			exerciseId: "own-bench",
			order: 0,
		});
		await database.sets.add({
			id: "own-set",
			workoutExerciseId: "own-we",
			order: 0,
			weightKg: 100,
			reps: 3,
		});
		const ownBefore = await findWorkoutDetail("own-workout", database);
		const benchBefore = await database.exercises.get("own-bench");

		const { workouts } = parseSample();
		const result = await importStrongWorkouts(workouts, database);

		expect(result.workoutsAdded).toBe(3);
		// The existing exercise is reused, not duplicated or changed.
		expect(result.exercisesCreated).toBe(5);
		expect(await database.exercises.get("own-bench")).toEqual(benchBefore);
		expect(await findWorkoutDetail("own-workout", database)).toEqual(ownBefore);
		expect(await database.workouts.count()).toBe(4);
		const imported = await database.workoutExercises
			.where("exerciseId")
			.equals("own-bench")
			.count();
		expect(imported).toBe(2);
	});

	it("reuses an archived exercise with the same name", async () => {
		const created = await createExercise("Plank", database);
		if (!created.ok) throw new Error(created.reason);
		await database.workoutExercises.add({
			id: "we",
			workoutId: "w",
			exerciseId: created.exercise.id,
			order: 0,
		});
		await removeExercise(created.exercise.id, 1, database);

		const workout = makeWorkout("Core", DAY_MS, [
			{ name: "  PLANK ", sets: [{ seconds: 60 }] },
		]);
		const result = await importStrongWorkouts([workout], database);

		expect(result.exercisesCreated).toBe(0);
		expect(await database.exercises.count()).toBe(1);
		const stored = await database.workoutExercises
			.where("exerciseId")
			.equals(created.exercise.id)
			.count();
		expect(stored).toBe(2);
	});

	it("re-checks for duplicates at write time", async () => {
		const workout = makeWorkout("Push Day", DAY_MS);
		const preview = await previewStrongImport([workout], [], database);
		expect(preview.workouts).toHaveLength(1);

		// Something else stores the same workout between preview and confirm.
		await importStrongWorkouts([workout], database);
		const result = await importStrongWorkouts(preview.workouts, database);

		expect(result.workoutsAdded).toBe(0);
		expect(await database.workouts.count()).toBe(1);
	});

	it("writes nothing when the write fails part-way", async () => {
		await database.workouts.add({
			id: "own",
			name: "Own",
			startedAt: 9 * DAY_MS,
			endedAt: 9 * DAY_MS + MINUTE_MS,
		});
		const before = await countRecords();
		// Two sets with the same id make the last bulkAdd fail inside the transaction.
		let calls = 0;
		const realRandomUUID = crypto.randomUUID.bind(crypto);
		vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
			calls++;
			return calls > 3
				? "00000000-0000-4000-8000-000000000000"
				: realRandomUUID();
		});

		await expect(
			importStrongWorkouts(
				[
					makeWorkout("A", DAY_MS, [
						{ name: "Squat", sets: [{ reps: 5 }, { reps: 5 }] },
					]),
				],
				database,
			),
		).rejects.toThrow();
		vi.restoreAllMocks();

		expect(await countRecords()).toEqual(before);
	});

	it("imports thousands of workouts", async () => {
		const workouts = Array.from({ length: 2_000 }, (_, i) =>
			makeWorkout(`Workout ${i % 7}`, i * DAY_MS, [
				{
					name: `Exercise ${i % 40}`,
					sets: [
						{ weightKg: 50, reps: 5 },
						{ weightKg: 55, reps: 5 },
					],
				},
				{ name: "Bench Press (Barbell)", sets: [{ weightKg: 80, reps: 5 }] },
			]),
		);

		const result = await importStrongWorkouts(workouts, database);

		expect(result.workoutsAdded).toBe(2_000);
		expect(result.exercisesCreated).toBe(41);
		expect(await database.sets.count()).toBe(6_000);
	});
});

describe("previewStrongImport", () => {
	it("reads existing exercises and workouts from the database", async () => {
		const { workouts } = parseSample();
		await importStrongWorkouts(workouts.slice(0, 1), database);

		const plan = await previewStrongImport(
			workouts,
			[{ line: 2, reason: "Rest timer row" }],
			database,
		);

		expect(plan.workouts.map((w) => w.name)).toEqual(["Evening Run", "Legs"]);
		expect(plan.duplicateCount).toBe(1);
		expect(plan.newExerciseNames).toEqual([
			"Running",
			"Plank",
			"Squat (Barbell)",
			"Leg Press",
		]);
		expect(plan.skipped).toHaveLength(1);
	});
});
