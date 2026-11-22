import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import sample from "../../fixtures/program-sample.json?raw";
import { WorkoutDB } from "./index";
import { parseProgram } from "./programFormat";
import {
	importProgram,
	nameProgramTemplate,
	previewProgramImport,
} from "./programImport";
import { listTemplates, startWorkoutFromTemplate } from "./templates";
import type { ProgramFile } from "./types";
import { startWorkout } from "./workoutLog";

let database: WorkoutDB;

beforeEach(async () => {
	database = new WorkoutDB(`test-${crypto.randomUUID()}`);
	await database.open();
});

afterEach(async () => {
	await database.delete();
});

function readSample(): ProgramFile {
	const parsed = parseProgram(sample);
	if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
	return parsed.program;
}

/** The sample program as another block of the same program. */
function readSampleBlock(block: number): ProgramFile {
	const program = readSample();
	return {
		...program,
		blocks: program.blocks.map((b) => ({ ...b, block })),
	};
}

describe("nameProgramTemplate", () => {
	const week = { week: 1, days: [] };
	it("names the program, week and day", () => {
		expect(
			nameProgramTemplate("Plan", 1, week, {
				day: "A",
				name: "Lower",
				exercises: [],
			}),
		).toBe("Plan · W1 · A — Lower");
		expect(
			nameProgramTemplate("Plan", 1, week, { day: "B", exercises: [] }),
		).toBe("Plan · W1 · B");
	});

	it("adds the block after the first", () => {
		expect(
			nameProgramTemplate("Plan", 2, week, { day: "A", exercises: [] }),
		).toBe("Plan · B2 · W1 · A");
	});
});

describe("previewProgramImport", () => {
	it("counts templates and splits exercises into matched and new", async () => {
		await database.exercises.bulkAdd([
			{ id: "squat", name: "Squat (Barbell)", nameKey: "squat (barbell)" },
			// Stored as weight and reps, the file says reps.
			{ id: "pull", name: "pull up", nameKey: "pull up" },
		]);
		const plan = await previewProgramImport(readSample(), database);

		expect(plan.templates).toHaveLength(8);
		expect(plan.matchedExerciseCount).toBe(2);
		expect(plan.newExercises).toEqual([
			{ name: "Romanian Deadlift (Barbell)", measure: "weight-reps" },
			{ name: "Plank", measure: "seconds" },
			{ name: "Bench Press (Barbell)", measure: "weight-reps" },
			{ name: "Farmer's Carry", measure: "distance" },
		]);
		expect(plan.measureMismatches).toEqual([
			{ name: "pull up", fileMeasure: "reps", libraryMeasure: "weight-reps" },
		]);
		expect(plan.alreadyImportedBlocks).toEqual([]);
		expect(await database.templates.count()).toBe(0);
	});
});

type DayExercises =
	ProgramFile["blocks"][number]["weeks"][number]["days"][number]["exercises"];

/** A program whose one day has the given exercises. */
function programWith(
	exercises: DayExercises,
	changes: Partial<ProgramFile> = {},
): ProgramFile {
	return {
		format: "workout-tracker-program",
		formatVersion: 1,
		programId: "p",
		name: "P",
		blocks: [
			{ block: 1, weeks: [{ week: 1, days: [{ day: "A", exercises }] }] },
		],
		...changes,
	};
}

describe("sets are checked against the library measure", () => {
	const libraryPlank = {
		id: "plank",
		name: "Plank",
		nameKey: "plank",
		measure: "seconds" as const,
	};
	const weighted = programWith([
		{ name: "plank", sets: [{ weightKg: 20, reps: 10 }] },
	]);
	const setPath = "blocks[0].weeks[0].days[0].exercises[0].sets[0]";

	it("reports sets a matched exercise's library measure does not use, when the file omits the measure", async () => {
		await database.exercises.add(libraryPlank);
		const plan = await previewProgramImport(weighted, database);

		expect(plan.setErrors).toEqual([
			`${setPath}.weightKg: is not used by the measure "seconds" (it uses seconds), which "Plank" has in your library.`,
			`${setPath}.reps: is not used by the measure "seconds" (it uses seconds), which "Plank" has in your library.`,
		]);
	});

	it("refuses to import them, writing nothing", async () => {
		await database.exercises.add(libraryPlank);
		const result = await importProgram(weighted, database);

		expect(result).toMatchObject({ ok: false, reason: "invalid-sets" });
		expect(await database.templates.count()).toBe(0);
	});

	it("accepts a timed set for a library exercise whose measure the file omits", async () => {
		await database.exercises.add(libraryPlank);
		const program = programWith([{ name: "Plank", sets: [{ seconds: 30 }] }]);
		const parsed = parseProgram(JSON.stringify(program));
		if (!parsed.ok) throw new Error(parsed.errors.join("\n"));

		expect((await previewProgramImport(program, database)).setErrors).toEqual(
			[],
		);
		expect((await importProgram(program, database)).ok).toBe(true);
		const [template] = await database.templates.toArray();
		expect(template?.exercises[0]?.sets).toEqual([{ seconds: 30 }]);
	});

	it("reports a mismatch warning and the sets the library measure cannot hold", async () => {
		await database.exercises.add(libraryPlank);
		const program = programWith([
			{ name: "Plank", measure: "weight-reps", sets: [{ weightKg: 20 }] },
		]);
		const plan = await previewProgramImport(program, database);

		expect(plan.measureMismatches).toEqual([
			{ name: "Plank", fileMeasure: "weight-reps", libraryMeasure: "seconds" },
		]);
		expect(plan.setErrors).toHaveLength(1);
	});

	it("keeps only the warning when the sets fit both measures", async () => {
		await database.exercises.add({
			id: "pull",
			name: "Pull Up",
			nameKey: "pull up",
		});
		const program = programWith([
			{ name: "Pull Up", measure: "reps", sets: [{ reps: 8 }] },
		]);
		const plan = await previewProgramImport(program, database);

		expect(plan.measureMismatches).toHaveLength(1);
		expect(plan.setErrors).toEqual([]);
	});

	it("checks a new exercise that omits its measure against the default", async () => {
		const plan = await previewProgramImport(
			programWith([{ name: "Wall Sit", sets: [{ seconds: 30 }] }]),
			database,
		);

		expect(plan.setErrors).toEqual([
			`${setPath}.seconds: is not used by the measure "weight-reps" (it uses weightKg, reps), which "Wall Sit" is given because the file names no measure for it.`,
		]);
	});

	it("starting a workout from an imported template keeps the planned values", async () => {
		await database.exercises.add(libraryPlank);
		await importProgram(
			programWith([{ name: "Plank", sets: [{ seconds: 45 }] }]),
			database,
		);
		const [template] = await listTemplates(database);
		if (!template) throw new Error("expected a template");
		const started = await startWorkoutFromTemplate(template.id, 1, database);
		if (!started.ok) throw new Error("expected a workout");

		expect((await database.sets.toArray()).map((set) => set.seconds)).toEqual([
			45,
		]);
	});
});

describe("programId and day ids", () => {
	const row: DayExercises = [{ name: "Row", sets: [{}] }];

	it("refuses a programId that differs only in case or spacing", async () => {
		const first = await importProgram(
			programWith(row, { programId: "up  down" }),
			database,
		);
		expect(first.ok).toBe(true);

		const again = await importProgram(
			programWith(row, { programId: " UP down " }),
			database,
		);
		expect(again).toEqual({
			ok: false,
			reason: "already-imported",
			blocks: [1],
		});
		expect(await database.templates.count()).toBe(1);
	});

	it("stores a day id with its inner spacing collapsed", async () => {
		const program = programWith(row);
		const day = program.blocks[0]?.weeks[0]?.days[0];
		if (!day) throw new Error("expected a day");
		day.day = " Upper   A ";
		const plan = await previewProgramImport(program, database);

		expect(plan.templates[0]?.program.day).toBe("Upper A");
	});
});

describe("importProgram", () => {
	it("adds a template per week and day with the program link, and the missing exercises", async () => {
		await database.exercises.add({
			id: "squat",
			name: "Squat (Barbell)",
			nameKey: "squat (barbell)",
		});
		const result = await importProgram(readSample(), database);

		expect(result).toEqual({
			ok: true,
			templatesCreated: 8,
			exercisesCreated: 5,
		});
		const templates = await listTemplates(database);
		expect(templates.map((t) => t.name).slice(0, 2)).toEqual([
			"Example Upper Lower · W1 · A — Lower",
			"Example Upper Lower · W1 · B — Upper",
		]);
		const deload = templates.find((t) => t.name.includes("W4 · A"));
		expect(deload?.program).toEqual({
			programId: "example-upper-lower",
			programName: "Example Upper Lower",
			block: 1,
			week: 4,
			day: "A",
			deload: true,
		});
		const first = deload?.exercises[0];
		expect(first?.exerciseId).toBe("squat");
		expect(first?.notes).toBe("Example loads only; plan your own.");
		expect(first?.sets[0]).toEqual({ warmup: true, weightKg: 20, reps: 10 });
		expect(first?.sets[1]).toEqual({
			weightKg: 50,
			repMin: 5,
			repMax: 8,
			targetRir: 3,
		});
		const plank = await database.exercises.get({ nameKey: "plank" });
		expect(plank?.measure).toBe("seconds");
		const bench = await database.exercises.get({
			nameKey: "bench press (barbell)",
		});
		expect(bench).not.toHaveProperty("measure");
	});

	it("leaves existing records and history untouched", async () => {
		await database.exercises.add({
			id: "squat",
			name: "Squat (Barbell)",
			nameKey: "squat (barbell)",
			archivedAt: 1,
		});
		await database.templates.add({ id: "mine", name: "Mine", exercises: [] });
		const started = await startWorkout(
			{ name: "Today", startedAt: 1 },
			database,
		);
		if (!started.ok) throw new Error("expected a workout");

		await importProgram(readSample(), database);

		expect(await database.exercises.get("squat")).toEqual({
			id: "squat",
			name: "Squat (Barbell)",
			nameKey: "squat (barbell)",
			archivedAt: 1,
		});
		expect(await database.templates.get("mine")).toEqual({
			id: "mine",
			name: "Mine",
			exercises: [],
		});
		expect(await database.workouts.toArray()).toEqual([started.workout]);
	});

	it("refuses a block of the program that is already imported, adding nothing", async () => {
		await importProgram(readSample(), database);
		const counts = [
			await database.templates.count(),
			await database.exercises.count(),
		];

		expect(await importProgram(readSample(), database)).toEqual({
			ok: false,
			reason: "already-imported",
			blocks: [1],
		});
		expect(
			(await previewProgramImport(readSample(), database))
				.alreadyImportedBlocks,
		).toEqual([1]);
		expect([
			await database.templates.count(),
			await database.exercises.count(),
		]).toEqual(counts);
	});

	it("adds a later block of the same program", async () => {
		await importProgram(readSample(), database);
		const result = await importProgram(readSampleBlock(2), database);

		expect(result).toEqual({
			ok: true,
			templatesCreated: 8,
			exercisesCreated: 0,
		});
		expect(await database.templates.count()).toBe(16);
	});

	it("imports the block again once its templates are deleted", async () => {
		await importProgram(readSample(), database);
		await database.templates.clear();

		expect((await importProgram(readSample(), database)).ok).toBe(true);
	});

	it("gives workouts started from its templates the program, block and week (ADR-0018)", async () => {
		await importProgram(readSample(), database);
		const template = (await listTemplates(database)).find((t) =>
			t.name.includes("W2 · B"),
		);
		if (!template) throw new Error("expected a template");
		const started = await startWorkoutFromTemplate(template.id, 1, database);
		if (!started.ok) throw new Error("expected a workout");

		expect(started.workout.source?.program).toMatchObject({
			programId: "example-upper-lower",
			block: 1,
			week: 2,
			day: "B",
		});
	});
});
