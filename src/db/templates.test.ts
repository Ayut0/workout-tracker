import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findWorkoutDetail, WorkoutDB } from "./index";
import {
	createTemplate,
	deleteTemplate,
	findTemplate,
	listTemplates,
	startWorkoutFromTemplate,
	templateFromWorkout,
	updateTemplate,
} from "./templates";
import type { Template, TemplateExercise } from "./types";
import {
	addSet,
	addWorkoutExercise,
	completeSet,
	finishWorkout,
	removeWorkoutExercise,
	startWorkout,
	updateSet,
	updateWorkout,
} from "./workoutLog";

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

const PUSH: TemplateExercise[] = [
	{
		exerciseId: "bench",
		sets: [
			{ weightKg: 60, reps: 8 },
			{ weightKg: 62.5, reps: 6 },
		],
	},
	{ exerciseId: "squat", sets: [{ reps: 5 }, {}] },
];

async function createPush(name = "Push day"): Promise<Template> {
	const result = await createTemplate({ name, exercises: PUSH }, database);
	if (!result.ok) throw new Error("expected a template");
	return result.template;
}

describe("createTemplate", () => {
	it("stores the name, exercises in order and planned sets", async () => {
		const template = await createPush("  Push   day ");

		expect(template.name).toBe("Push day");
		expect(await findTemplate(template.id, database)).toEqual({
			id: template.id,
			name: "Push day",
			exercises: PUSH,
		});
	});

	it("rejects a blank name", async () => {
		expect(
			await createTemplate({ name: "  ", exercises: PUSH }, database),
		).toEqual({ ok: false, reason: "empty" });
		expect(await database.templates.count()).toBe(0);
	});

	it("does not keep the caller's arrays", async () => {
		const exercises: TemplateExercise[] = [
			{ exerciseId: "bench", sets: [{ weightKg: 60 }] },
		];
		const result = await createTemplate({ name: "A", exercises }, database);
		exercises[0]?.sets.push({ reps: 1 });

		if (!result.ok) throw new Error("expected a template");
		expect(result.template.exercises[0]?.sets).toEqual([{ weightKg: 60 }]);
	});
});

describe("updateTemplate", () => {
	it("replaces the name and exercises", async () => {
		const template = await createPush();
		const exercises = [{ exerciseId: "squat", sets: [{ weightKg: 100 }] }];

		const result = await updateTemplate(
			template.id,
			{ name: "Legs", exercises },
			database,
		);

		expect(result.ok).toBe(true);
		expect(await findTemplate(template.id, database)).toEqual({
			id: template.id,
			name: "Legs",
			exercises,
		});
	});

	it("rejects a blank name and keeps the template", async () => {
		const template = await createPush();

		expect(
			await updateTemplate(template.id, { name: "", exercises: [] }, database),
		).toEqual({ ok: false, reason: "empty" });
		expect(await findTemplate(template.id, database)).toEqual(template);
	});

	it("reports a template that does not exist", async () => {
		expect(
			await updateTemplate("nope", { name: "A", exercises: [] }, database),
		).toEqual({ ok: false, reason: "not-found" });
		expect(await database.templates.count()).toBe(0);
	});
});

describe("deleteTemplate", () => {
	it("deletes only the template", async () => {
		const template = await createPush();
		const other = await createPush("Other");

		expect(await deleteTemplate(template.id, database)).toBe(true);

		expect(await findTemplate(template.id, database)).toBeUndefined();
		expect(await findTemplate(other.id, database)).toEqual(other);
		expect(await database.exercises.count()).toBe(2);
		expect(await deleteTemplate(template.id, database)).toBe(false);
	});
});

describe("listTemplates", () => {
	it("sorts by name ignoring case", async () => {
		await createPush("legs");
		await createPush("Arms");
		await createPush("Push");

		const names = (await listTemplates(database)).map((t) => t.name);

		expect(names).toEqual(["Arms", "legs", "Push"]);
	});
});

describe("startWorkoutFromTemplate", () => {
	it("starts a workout named after the template with its exercises and sets copied", async () => {
		const template = await createPush();

		const result = await startWorkoutFromTemplate(template.id, 5_000, database);

		if (!result.ok) throw new Error("expected a workout");
		expect(result.workout).toMatchObject({
			name: "Push day",
			startedAt: 5_000,
		});
		const detail = await findWorkoutDetail(result.workout.id, database);
		expect(
			detail?.exercises.map((e) => ({
				exerciseId: e.workoutExercise.exerciseId,
				sets: e.sets.map(({ weightKg, reps, completedAt }) => ({
					weightKg,
					reps,
					completedAt,
				})),
			})),
		).toEqual([
			{
				exerciseId: "bench",
				sets: [
					{ weightKg: 60, reps: 8, completedAt: undefined },
					{ weightKg: 62.5, reps: 6, completedAt: undefined },
				],
			},
			{
				exerciseId: "squat",
				sets: [
					{ weightKg: undefined, reps: 5, completedAt: undefined },
					{ weightKg: undefined, reps: undefined, completedAt: undefined },
				],
			},
		]);
	});

	it("leaves the template unchanged when the workout is edited", async () => {
		const template = await createPush();
		const result = await startWorkoutFromTemplate(template.id, 5_000, database);
		if (!result.ok) throw new Error("expected a workout");
		const detail = await findWorkoutDetail(result.workout.id, database);
		const [bench, squat] = detail?.exercises ?? [];
		if (!bench || !squat) throw new Error("expected two exercises");

		await updateWorkout(result.workout.id, { name: "Renamed" }, database);
		const firstSet = bench.sets[0];
		if (!firstSet) throw new Error("expected a set");
		await updateSet(firstSet.id, { weightKg: 80, reps: 3 }, database);
		await completeSet(firstSet.id, 6_000, database);
		await addSet(bench.workoutExercise.id, database);
		await removeWorkoutExercise(squat.workoutExercise.id, database);
		await addWorkoutExercise(result.workout.id, "squat", database);
		await finishWorkout(result.workout.id, 7_000, database);

		expect(await findTemplate(template.id, database)).toEqual(template);
	});

	it("does not start while a workout is active", async () => {
		const template = await createPush();
		const first = await startWorkout(
			{ name: "Other", startedAt: 1_000 },
			database,
		);
		if (!first.ok) throw new Error("expected a workout");

		const result = await startWorkoutFromTemplate(template.id, 5_000, database);

		expect(result).toEqual({
			ok: false,
			reason: "active",
			active: first.workout,
		});
		expect(await database.workouts.count()).toBe(1);
	});

	it("reports a template that does not exist", async () => {
		expect(await startWorkoutFromTemplate("nope", 5_000, database)).toEqual({
			ok: false,
			reason: "not-found",
		});
		expect(await database.workouts.count()).toBe(0);
	});
});

describe("templateFromWorkout", () => {
	async function logWorkout() {
		const started = await startWorkout(
			{
				name: "Monday push",
				startedAt: 1_000,
				exercises: [
					{
						exerciseId: "bench",
						sets: [
							{ weightKg: 60, reps: 8 },
							{ weightKg: 65, reps: 5 },
							{ weightKg: 70, reps: 3 },
						],
					},
					{ exerciseId: "squat", sets: [{ weightKg: 100, reps: 5 }] },
				],
			},
			database,
		);
		if (!started.ok) throw new Error("expected a workout");
		const detail = await findWorkoutDetail(started.workout.id, database);
		const benchSets = detail?.exercises[0]?.sets ?? [];
		// Bench sets 1 and 3 done; set 2 and the squat set skipped.
		for (const set of [benchSets[0], benchSets[2]]) {
			if (set) await completeSet(set.id, 2_000, database);
		}
		await finishWorkout(started.workout.id, 3_000, database);
		return started.workout;
	}

	it("saves the workout's name, exercises and complete sets as a new template", async () => {
		const workout = await logWorkout();

		const result = await templateFromWorkout(workout.id, database);

		if (!result.ok) throw new Error("expected a template");
		expect(result.template.name).toBe("Monday push");
		expect(result.template.exercises).toEqual([
			{
				exerciseId: "bench",
				sets: [
					{ weightKg: 60, reps: 8 },
					{ weightKg: 70, reps: 3 },
				],
			},
		]);
		expect(await findTemplate(result.template.id, database)).toEqual(
			result.template,
		);
	});

	it("refuses a workout with no complete sets", async () => {
		const started = await startWorkout(
			{
				name: "Skipped",
				startedAt: 1_000,
				exercises: [{ exerciseId: "bench", sets: [{ reps: 5 }] }],
			},
			database,
		);
		if (!started.ok) throw new Error("expected a workout");

		expect(await templateFromWorkout(started.workout.id, database)).toEqual({
			ok: false,
			reason: "no-complete-sets",
		});
		expect(await database.templates.count()).toBe(0);
	});

	it("reports a workout that does not exist", async () => {
		expect(await templateFromWorkout("nope", database)).toEqual({
			ok: false,
			reason: "not-found",
		});
	});
});
