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

describe("planned sets measured by time or distance (ADR-0012)", () => {
	beforeEach(async () => {
		await database.exercises.bulkAdd([
			{ id: "plank", name: "Plank", nameKey: "plank", measure: "seconds" },
			{ id: "carry", name: "Carry", nameKey: "carry", measure: "distance" },
		]);
	});

	it("carry seconds and distance from template to workout and back", async () => {
		const created = await createTemplate(
			{
				name: "Core",
				exercises: [
					{ exerciseId: "plank", sets: [{ seconds: 60 }] },
					{ exerciseId: "carry", sets: [{ distanceM: 40 }] },
				],
			},
			database,
		);
		if (!created.ok) throw new Error("expected a template");

		const started = await startWorkoutFromTemplate(
			created.template.id,
			5_000,
			database,
		);
		if (!started.ok) throw new Error("expected a workout");
		const detail = await findWorkoutDetail(started.workout.id, database);
		const sets = detail?.exercises.flatMap((entry) => entry.sets) ?? [];
		expect(sets).toMatchObject([{ seconds: 60 }, { distanceM: 40 }]);

		for (const set of sets) await completeSet(set.id, 6_000, database);
		await finishWorkout(started.workout.id, 7_000, database);
		const saved = await templateFromWorkout(started.workout.id, database);
		if (!saved.ok) throw new Error("expected a template");
		expect(saved.template.exercises).toEqual([
			{ exerciseId: "plank", sets: [{ seconds: 60 }] },
			{ exerciseId: "carry", sets: [{ distanceM: 40 }] },
		]);
	});

	it("start sets with only what the exercise's measure shows", async () => {
		// Weight and reps kept hidden after the plank's measure changed.
		const created = await createTemplate(
			{
				name: "Core",
				exercises: [
					{ exerciseId: "plank", sets: [{ weightKg: 10, seconds: 60 }] },
				],
			},
			database,
		);
		if (!created.ok) throw new Error("expected a template");

		const started = await startWorkoutFromTemplate(
			created.template.id,
			5_000,
			database,
		);
		if (!started.ok) throw new Error("expected a workout");
		const detail = await findWorkoutDetail(started.workout.id, database);
		const [set] = detail?.exercises[0]?.sets ?? [];
		expect(set?.seconds).toBe(60);
		expect(set && "weightKg" in set).toBe(false);
	});
});

describe("warm-up sets (#65)", () => {
	it("are stored on planned sets", async () => {
		const created = await createTemplate(
			{
				name: "Push",
				exercises: [
					{
						exerciseId: "bench",
						sets: [{ weightKg: 40, reps: 10, warmup: true }, { weightKg: 60 }],
					},
				],
			},
			database,
		);
		if (!created.ok) throw new Error("expected a template");
		expect(created.template.exercises[0]?.sets).toEqual([
			{ weightKg: 40, reps: 10, warmup: true },
			{ weightKg: 60 },
		]);
	});

	it("store a planned set's warmup: false as no mark", async () => {
		const created = await createTemplate(
			{
				name: "Push",
				exercises: [
					{
						exerciseId: "bench",
						sets: [{ weightKg: 40, warmup: false }],
					},
				],
			},
			database,
		);
		if (!created.ok) throw new Error("expected a template");
		const set = created.template.exercises[0]?.sets[0];
		expect(set).toEqual({ weightKg: 40 });
		expect(set && "warmup" in set).toBe(false);
	});

	it("carry the mark from template to workout and back", async () => {
		const created = await createTemplate(
			{
				name: "Push",
				exercises: [
					{
						exerciseId: "bench",
						sets: [
							{ weightKg: 40, reps: 10, warmup: true },
							{ weightKg: 60, reps: 8 },
						],
					},
				],
			},
			database,
		);
		if (!created.ok) throw new Error("expected a template");

		const started = await startWorkoutFromTemplate(
			created.template.id,
			5_000,
			database,
		);
		if (!started.ok) throw new Error("expected a workout");
		const detail = await findWorkoutDetail(started.workout.id, database);
		const sets = detail?.exercises[0]?.sets ?? [];
		expect(sets[0]).toMatchObject({ weightKg: 40, reps: 10, warmup: true });
		expect(sets[1] && "warmup" in sets[1]).toBe(false);

		for (const set of sets) await completeSet(set.id, 6_000, database);
		await finishWorkout(started.workout.id, 7_000, database);
		const saved = await templateFromWorkout(started.workout.id, database);
		if (!saved.ok) throw new Error("expected a template");
		expect(saved.template.exercises[0]?.sets).toEqual([
			{ weightKg: 40, reps: 10, warmup: true },
			{ weightKg: 60, reps: 8 },
		]);
	});
});

describe("template exercise notes (ADR-0014)", () => {
	it("are trimmed when saved, and blank notes are not stored", async () => {
		const result = await createTemplate(
			{
				name: "Push",
				exercises: [
					{ exerciseId: "bench", sets: [{}], notes: "  seat 4  " },
					{ exerciseId: "squat", sets: [{}], notes: "   " },
				],
			},
			database,
		);

		if (!result.ok) throw new Error("expected a template");
		expect(result.template.exercises).toEqual([
			{ exerciseId: "bench", sets: [{}], notes: "seat 4" },
			{ exerciseId: "squat", sets: [{}] },
		]);
	});

	it("are copied into a workout started from the template", async () => {
		const created = await createTemplate(
			{
				name: "Push",
				exercises: [
					{ exerciseId: "bench", sets: [{}], notes: "pause at the bottom" },
					{ exerciseId: "squat", sets: [{}] },
				],
			},
			database,
		);
		if (!created.ok) throw new Error("expected a template");

		const started = await startWorkoutFromTemplate(
			created.template.id,
			1_000,
			database,
		);

		if (!started.ok) throw new Error("expected a workout");
		const detail = await findWorkoutDetail(started.workout.id, database);
		expect(detail?.exercises[0]?.workoutExercise.notes).toBe(
			"pause at the bottom",
		);
		expect(
			Object.hasOwn(detail?.exercises[1]?.workoutExercise ?? {}, "notes"),
		).toBe(false);
	});

	it("are not changed in past workouts when the template is edited", async () => {
		const created = await createTemplate(
			{
				name: "Push",
				exercises: [{ exerciseId: "bench", sets: [{}], notes: "seat 4" }],
			},
			database,
		);
		if (!created.ok) throw new Error("expected a template");
		const started = await startWorkoutFromTemplate(
			created.template.id,
			1_000,
			database,
		);
		if (!started.ok) throw new Error("expected a workout");

		await updateTemplate(
			created.template.id,
			{
				name: "Push",
				exercises: [{ exerciseId: "bench", sets: [{}], notes: "seat 5" }],
			},
			database,
		);

		const detail = await findWorkoutDetail(started.workout.id, database);
		expect(detail?.exercises[0]?.workoutExercise.notes).toBe("seat 4");
	});

	it("carry back when a workout is saved as a template", async () => {
		const started = await startWorkout(
			{
				name: "Push",
				startedAt: 1_000,
				exercises: [
					{
						exerciseId: "bench",
						sets: [{ weightKg: 60, reps: 8 }],
						notes: "seat 4",
					},
				],
			},
			database,
		);
		if (!started.ok) throw new Error("expected a workout");
		const detail = await findWorkoutDetail(started.workout.id, database);
		const set = detail?.exercises[0]?.sets[0];
		if (set) await completeSet(set.id, 2_000, database);

		const result = await templateFromWorkout(started.workout.id, database);

		if (!result.ok) throw new Error("expected a template");
		expect(result.template.exercises).toEqual([
			{
				exerciseId: "bench",
				sets: [{ weightKg: 60, reps: 8 }],
				notes: "seat 4",
			},
		]);
	});
});

describe("planned rep range and target RIR (ADR-0014)", () => {
	const TARGETED: TemplateExercise[] = [
		{
			exerciseId: "bench",
			sets: [
				{ weightKg: 80, reps: 5, repMin: 4, repMax: 6, targetRir: 2 },
				{ weightKg: 60, reps: 10, repMin: 8, repMax: 10 },
			],
		},
	];

	it("are stored on template sets", async () => {
		const result = await createTemplate(
			{ name: "Push", exercises: TARGETED },
			database,
		);

		if (!result.ok) throw new Error("expected a template");
		expect(result.template.exercises).toEqual(TARGETED);
	});

	it("are copied into the workout's sets, like weight and reps", async () => {
		const created = await createTemplate(
			{ name: "Push", exercises: TARGETED },
			database,
		);
		if (!created.ok) throw new Error("expected a template");

		const started = await startWorkoutFromTemplate(
			created.template.id,
			1_000,
			database,
		);

		if (!started.ok) throw new Error("expected a workout");
		const detail = await findWorkoutDetail(started.workout.id, database);
		expect(
			detail?.exercises[0]?.sets.map(
				({ weightKg, reps, repMin, repMax, targetRir }) => ({
					weightKg,
					reps,
					repMin,
					repMax,
					targetRir,
				}),
			),
		).toEqual([
			{ weightKg: 80, reps: 5, repMin: 4, repMax: 6, targetRir: 2 },
			{ weightKg: 60, reps: 10, repMin: 8, repMax: 10, targetRir: undefined },
		]);
	});

	it("do not carry into a set added during the workout, but do carry back into a template", async () => {
		const started = await startWorkout(
			{ name: "Push", startedAt: 1_000, exercises: TARGETED },
			database,
		);
		if (!started.ok) throw new Error("expected a workout");
		const detail = await findWorkoutDetail(started.workout.id, database);
		const entry = detail?.exercises[0];
		if (!entry) throw new Error("expected an exercise");

		const added = await addSet(entry.workoutExercise.id, database);

		expect(added).toMatchObject({ weightKg: 60, reps: 10 });
		expect(added && "repMin" in added).toBe(false);
		expect(added && "repMax" in added).toBe(false);
		expect(added && "targetRir" in added).toBe(false);
		for (const set of entry.sets) await completeSet(set.id, 2_000, database);
		const result = await templateFromWorkout(started.workout.id, database);
		if (!result.ok) throw new Error("expected a template");
		expect(result.template.exercises[0]?.sets).toEqual(TARGETED[0]?.sets);
	});

	it("are not planned for a measure without reps", async () => {
		await database.exercises.update("squat", { measure: "seconds" });

		const started = await startWorkout(
			{
				name: "Core",
				startedAt: 1_000,
				exercises: [
					{
						exerciseId: "squat",
						sets: [{ seconds: 60, repMin: 4, repMax: 6, targetRir: 1 }],
					},
				],
			},
			database,
		);

		if (!started.ok) throw new Error("expected a workout");
		const detail = await findWorkoutDetail(started.workout.id, database);
		const set = detail?.exercises[0]?.sets[0];
		expect(set?.seconds).toBe(60);
		expect(set && "repMin" in set).toBe(false);
		expect(set && "targetRir" in set).toBe(false);
	});
});
