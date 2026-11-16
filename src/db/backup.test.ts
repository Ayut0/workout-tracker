import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	BACKUP_FORMAT,
	BACKUP_FORMAT_VERSION,
	BACKUP_SCHEMA_VERSION,
	BACKUP_STORES,
	type Backup,
	exportBackup,
	previewRestore,
	recordLastBackup,
	restoreBackup,
} from "./backup";
import { parseBackup } from "./backupFormat";
import { findSettings, SETTINGS_ID, saveSettings, WorkoutDB } from "./index";
import { TIMER_STATUS } from "./types";

let database: WorkoutDB;

beforeEach(async () => {
	database = new WorkoutDB(`test-${crypto.randomUUID()}`);
	await database.open();
});

afterEach(async () => {
	await database.delete();
});

const T0 = Date.UTC(2026, 9, 1, 8);
const HOUR_MS = 3_600_000;

/** Puts records in every backed-up store, using every optional field. */
async function seedEveryStore(target: WorkoutDB) {
	await target.exercises.bulkAdd([
		{ id: "ex-bench", name: "Bench Press", nameKey: "bench press" },
		{
			id: "ex-squat",
			name: "Squat",
			nameKey: "squat",
			restSeconds: 180,
			archivedAt: T0,
			measure: "distance",
			primaryMuscles: ["glutes", "quads"],
			secondaryMuscles: ["adductors"],
			movementPattern: "squat",
			category: "strength",
			equipment: "barbell",
		},
	]);
	await target.workouts.bulkAdd([
		{
			id: "w-done",
			name: "Push",
			startedAt: T0,
			endedAt: T0 + HOUR_MS,
			notes: "felt strong",
		},
		{ id: "w-active", name: "Legs", startedAt: T0 + 24 * HOUR_MS },
	]);
	await target.workoutExercises.bulkAdd([
		{
			id: "we-1",
			workoutId: "w-done",
			exerciseId: "ex-bench",
			order: 0,
			notes: "seat 4",
		},
		{ id: "we-2", workoutId: "w-active", exerciseId: "ex-squat", order: 0 },
	]);
	await target.sets.bulkAdd([
		{
			id: "s-1",
			workoutExerciseId: "we-1",
			order: 0,
			weightKg: 82.5,
			reps: 5,
			rpe: 8.5,
			warmup: true,
			notes: "paused",
			completedAt: T0 + 10 * 60_000,
		},
		{
			id: "s-2",
			workoutExerciseId: "we-2",
			order: 0,
			distanceM: 400,
			seconds: 90,
		},
	]);
	await target.templates.add({
		id: "t-1",
		name: "Push day",
		exercises: [
			{
				exerciseId: "ex-bench",
				sets: [
					{ weightKg: 40, reps: 10, warmup: true },
					{ weightKg: 80, reps: 5 },
				],
				notes: "seat 4",
			},
			{ exerciseId: "ex-squat", sets: [{ seconds: 60, distanceM: 40 }] },
		],
	});
	await saveSettings(
		{ weightUnit: "lb", restSeconds: 120, lastBackupAt: T0 },
		target,
	);
	// Obviously made-up measurements.
	await target.bodyEntries.bulkAdd([
		{ id: "b-1", date: "2026-10-01", bodyWeightKg: 70.25, waistCm: 80 },
		{ id: "b-2", date: "2026-10-02", bodyWeightKg: 70 },
		{ id: "b-3", date: "2026-10-03", waistCm: 79.5 },
	]);
}

async function wipe(target: WorkoutDB) {
	await Promise.all(BACKUP_STORES.map((store) => target[store].clear()));
}

function parseOrThrow(text: string): Backup {
	const parsed = parseBackup(text);
	if (!parsed.ok) throw new Error(parsed.reason);
	return parsed.backup;
}

function makeFile(changes: Record<string, unknown>): string {
	return JSON.stringify({
		format: BACKUP_FORMAT,
		formatVersion: BACKUP_FORMAT_VERSION,
		schemaVersion: BACKUP_SCHEMA_VERSION,
		exportedAt: T0,
		data: {
			exercises: [],
			workouts: [],
			workoutExercises: [],
			sets: [],
			templates: [],
			settings: [],
			bodyEntries: [],
		},
		...changes,
	});
}

describe("backup format", () => {
	it("is written at the database's schema version", () => {
		// A schema bump must come with a backup migration (ADR-0011).
		expect(database.verno).toBe(BACKUP_SCHEMA_VERSION);
	});

	it("exports every backed-up store with the envelope", async () => {
		await seedEveryStore(database);
		const backup = await exportBackup(T0 + 5, database);

		expect(backup).toMatchObject({
			format: "workout-tracker-backup",
			formatVersion: 1,
			schemaVersion: 3,
			exportedAt: T0 + 5,
		});
		expect(Object.keys(backup.data).sort()).toEqual([...BACKUP_STORES].sort());
		expect(backup.data.sets).toHaveLength(2);
		expect(backup.data.settings).toEqual([
			{ id: SETTINGS_ID, weightUnit: "lb", restSeconds: 120, lastBackupAt: T0 },
		]);
		expect(backup.data.bodyEntries).toHaveLength(3);
	});
});

describe("restore", () => {
	it("round-trips: export, wipe, restore gives identical data", async () => {
		await seedEveryStore(database);
		const before = await exportBackup(T0, database);
		const file = JSON.stringify(before);

		await wipe(database);
		expect(await database.workouts.count()).toBe(0);
		await restoreBackup(parseOrThrow(file), database);

		const after = await exportBackup(T0, database);
		expect(after).toStrictEqual(before);
	});

	it("replaces what is stored instead of merging", async () => {
		await seedEveryStore(database);
		const backup = parseOrThrow(
			JSON.stringify(await exportBackup(T0, database)),
		);
		await database.exercises.add({
			id: "ex-new",
			name: "Row",
			nameKey: "row",
		});
		await database.workouts.delete("w-done");

		await restoreBackup(backup, database);

		expect(await database.exercises.get("ex-new")).toBeUndefined();
		expect(await database.workouts.get("w-done")).toMatchObject({
			name: "Push",
		});
	});

	it("leaves the data stored before untouched when a write fails", async () => {
		await seedEveryStore(database);
		const before = await exportBackup(T0, database);
		// Skips parseBackup, which would reject the clash, so the write fails
		// after the stores are cleared and some records are added.
		const clashing: Backup = {
			...before,
			data: {
				...before.data,
				exercises: [],
				sets: [
					{ id: "dup", workoutExerciseId: "we-1", order: 0 },
					{ id: "dup", workoutExerciseId: "we-1", order: 1 },
				],
			},
		};

		await expect(restoreBackup(clashing, database)).rejects.toThrow();

		expect(await exportBackup(T0, database)).toStrictEqual(before);
	});

	it("does not touch the rest-timer diagnostics", async () => {
		const timer = {
			id: "timer-1",
			scheduledAt: T0,
			createdAt: T0,
			status: TIMER_STATUS.pending,
		};
		await database.restTimers.add(timer);

		await restoreBackup(parseOrThrow(makeFile({})), database);

		expect(await database.restTimers.toArray()).toEqual([timer]);
	});

	it("previews counts against what is stored, and the active workouts", async () => {
		await seedEveryStore(database);
		const backup = parseOrThrow(
			makeFile({
				data: {
					exercises: [{ id: "e", name: "Row", nameKey: "row" }],
					workouts: [{ id: "w", name: "Pull", startedAt: T0 }],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
					bodyEntries: [{ id: "b", date: "2026-10-05", waistCm: 81 }],
				},
			}),
		);

		const preview = await previewRestore(backup, database);

		expect(preview.incoming).toEqual({
			exercises: 1,
			workouts: 1,
			workoutExercises: 0,
			sets: 0,
			templates: 0,
			settings: 0,
			bodyEntries: 1,
		});
		expect(preview.current).toEqual({
			exercises: 2,
			workouts: 2,
			workoutExercises: 2,
			sets: 2,
			templates: 1,
			settings: 1,
			bodyEntries: 3,
		});
		expect(preview.currentActive?.id).toBe("w-active");
		expect(preview.incomingActive?.id).toBe("w");
	});
});

describe("restoring blank notes (ADR-0014)", () => {
	it("drops blank notes so stored data never holds them", () => {
		const parsed = parseBackup(
			makeFile({
				data: {
					exercises: [],
					workouts: [],
					workoutExercises: [
						{ id: "a", workoutId: "w", exerciseId: "e", order: 0, notes: "" },
						{ id: "b", workoutId: "w", exerciseId: "e", order: 1, notes: "  " },
						{
							id: "c",
							workoutId: "w",
							exerciseId: "e",
							order: 2,
							notes: " hi ",
						},
					],
					sets: [],
					templates: [
						{
							id: "t",
							name: "A",
							exercises: [
								{ exerciseId: "e", sets: [], notes: " \n" },
								{ exerciseId: "f", sets: [], notes: " seat 4 " },
							],
						},
					],
					settings: [],
					bodyEntries: [],
				},
			}),
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		const { workoutExercises, templates } = parsed.backup.data;
		expect(workoutExercises.map((w) => w.notes)).toEqual([
			undefined,
			undefined,
			"hi",
		]);
		expect(Object.hasOwn(workoutExercises[0] ?? {}, "notes")).toBe(false);
		expect(templates[0]?.exercises.map((e) => e.notes)).toEqual([
			undefined,
			"seat 4",
		]);
		expect(Object.hasOwn(templates[0]?.exercises[0] ?? {}, "notes")).toBe(
			false,
		);
	});
});

describe("restoring an older schema version", () => {
	it("migrates a version-1 backup, which held no training records", async () => {
		await seedEveryStore(database);
		const parsed = parseBackup(
			makeFile({
				schemaVersion: 1,
				data: {
					restTimers: [
						{ id: "x", scheduledAt: T0, createdAt: T0, status: "received" },
					],
				},
			}),
		);

		expect(parsed).toMatchObject({ ok: true, migratedFrom: 1 });
		if (!parsed.ok) return;
		expect(parsed.backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);

		await restoreBackup(parsed.backup, database);
		const after = await exportBackup(T0, database);
		for (const store of BACKUP_STORES) expect(after.data[store]).toEqual([]);
	});

	it("restores exercises and planned sets from before measures (ADR-0012)", () => {
		// Written before #63 (schema version 2): no measure, template sets with
		// weight and reps only.
		const parsed = parseBackup(
			makeFile({
				schemaVersion: 2,
				data: {
					exercises: [{ id: "e", name: "Row", nameKey: "row" }],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [
						{
							id: "t",
							name: "Pull",
							exercises: [{ exerciseId: "e", sets: [{ weightKg: 60 }] }],
						},
					],
					settings: [],
				},
			}),
		);

		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.backup.data.exercises).toEqual([
			{ id: "e", name: "Row", nameKey: "row" },
		]);
	});

	it("migrates a version-2 backup, keeping every record and adding an empty body log", async () => {
		await seedEveryStore(database);
		const current = await exportBackup(T0, database);
		// A file as version 2 wrote it: no bodyEntries store.
		const { bodyEntries: _bodyEntries, ...v2Data } = current.data;
		const parsed = parseBackup(
			makeFile({ schemaVersion: 2, exportedAt: T0, data: v2Data }),
		);

		expect(parsed).toMatchObject({ ok: true, migratedFrom: 2 });
		if (!parsed.ok) return;
		expect(parsed.backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);

		// Restore replaces everything: the body log stored here is cleared too.
		await restoreBackup(parsed.backup, database);
		const after = await exportBackup(T0, database);
		expect(after.data).toStrictEqual({ ...v2Data, bodyEntries: [] });
	});

	it("migrates a version-1 backup through every step", () => {
		const parsed = parseBackup(makeFile({ schemaVersion: 1, data: {} }));

		expect(parsed).toMatchObject({ ok: true, migratedFrom: 1 });
		if (!parsed.ok) return;
		expect(parsed.backup.data.bodyEntries).toEqual([]);
	});

	it("rejects a version with no migration clearly", () => {
		expect(parseBackup(makeFile({ schemaVersion: 0 }))).toEqual({
			ok: false,
			reason: "This backup's version is not valid.",
		});
	});
});

describe("parseBackup rejects", () => {
	it.each([
		["text that is not JSON", "not json {", /not JSON/],
		[
			"other JSON",
			JSON.stringify({ hello: 1 }),
			/not a workout-tracker backup/,
		],
		[
			"a newer schema version",
			makeFile({ schemaVersion: BACKUP_SCHEMA_VERSION + 1 }),
			/newer version of the app \(data version 4; this app reads up to 3\)/,
		],
		[
			"a newer file format",
			makeFile({ formatVersion: BACKUP_FORMAT_VERSION + 1 }),
			/newer version of the app \(file format 2/,
		],
		[
			"missing versions",
			makeFile({ schemaVersion: "2" }),
			/does not say which version/,
		],
		["no export time", makeFile({ exportedAt: null }), /when it was made/],
		[
			"a missing store",
			makeFile({ data: { exercises: [] } }),
			/no list of "workouts"/,
		],
		[
			"a record whose id is not a string",
			makeFile({
				data: {
					exercises: [{ id: 7, name: "Row", nameKey: "row" }],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
				},
			}),
			/Exercise record 1: id must be an id/,
		],
		[
			"a record missing a required field",
			makeFile({
				data: {
					exercises: [],
					workouts: [{ id: "w", name: "Push" }],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
				},
			}),
			/Workout record 1: startedAt must be a number/,
		],
		[
			"a template set of the wrong shape",
			makeFile({
				data: {
					exercises: [],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [
						{
							id: "t",
							name: "A",
							exercises: [{ exerciseId: "e", sets: [{ reps: "5" }] }],
						},
					],
					settings: [],
				},
			}),
			/Template record 1: exercises item 1: sets item 1: reps must be a number/,
		],
		[
			"an unknown exercise measure",
			makeFile({
				data: {
					exercises: [
						{ id: "e", name: "Row", nameKey: "row", measure: "calories" },
					],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
				},
			}),
			/Exercise record 1: measure must be "weight-reps" or "reps" or "seconds" or "distance"/,
		],
		[
			"an unknown muscle group",
			makeFile({
				data: {
					exercises: [
						{
							id: "e",
							name: "Row",
							nameKey: "row",
							primaryMuscles: ["lats", "wings"],
						},
					],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
					bodyEntries: [],
				},
			}),
			/Exercise record 1: primaryMuscles item 2 must be "chest" or /,
		],
		[
			"secondary muscles that are not a list",
			makeFile({
				data: {
					exercises: [
						{
							id: "e",
							name: "Row",
							nameKey: "row",
							secondaryMuscles: "biceps",
						},
					],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
					bodyEntries: [],
				},
			}),
			/Exercise record 1: secondaryMuscles must be a list/,
		],
		[
			"an unknown movement pattern",
			makeFile({
				data: {
					exercises: [
						{ id: "e", name: "Row", nameKey: "row", movementPattern: "push" },
					],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
					bodyEntries: [],
				},
			}),
			/Exercise record 1: movementPattern must be "squat" or /,
		],
		[
			"an unknown exercise category",
			makeFile({
				data: {
					exercises: [
						{ id: "e", name: "Row", nameKey: "row", category: "cardio" },
					],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
					bodyEntries: [],
				},
			}),
			/Exercise record 1: category must be "strength" or /,
		],
		[
			"unknown equipment",
			makeFile({
				data: {
					exercises: [
						{ id: "e", name: "Row", nameKey: "row", equipment: "kettlebell" },
					],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
					bodyEntries: [],
				},
			}),
			/Exercise record 1: equipment must be "barbell" or /,
		],
		[
			"a template set's seconds that are not a number",
			makeFile({
				data: {
					exercises: [],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [
						{
							id: "t",
							name: "A",
							exercises: [{ exerciseId: "e", sets: [{ seconds: "60" }] }],
						},
					],
					settings: [],
				},
			}),
			/Template record 1: exercises item 1: sets item 1: seconds must be a number/,
		],
		[
			"a set's warm-up mark that is not true or false",
			makeFile({
				data: {
					exercises: [],
					workouts: [],
					workoutExercises: [],
					sets: [{ id: "s", workoutExerciseId: "we", order: 0, warmup: "yes" }],
					templates: [],
					settings: [],
				},
			}),
			/Set record 1: warmup must be true or false/,
		],
		[
			"a template set's warm-up mark that is not true or false",
			makeFile({
				data: {
					exercises: [],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [
						{
							id: "t",
							name: "A",
							exercises: [{ exerciseId: "e", sets: [{ warmup: 1 }] }],
						},
					],
					settings: [],
				},
			}),
			/Template record 1: exercises item 1: sets item 1: warmup must be true or false/,
		],
		[
			"template exercise notes that are not text (ADR-0014)",
			makeFile({
				data: {
					exercises: [],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [
						{
							id: "t",
							name: "A",
							exercises: [{ exerciseId: "e", sets: [], notes: 4 }],
						},
					],
					settings: [],
					bodyEntries: [],
				},
			}),
			/Template record 1: exercises item 1: notes must be text/,
		],
		[
			"workout exercise notes that are not text (ADR-0014)",
			makeFile({
				data: {
					exercises: [],
					workouts: [],
					workoutExercises: [
						{
							id: "we",
							workoutId: "w",
							exerciseId: "e",
							order: 0,
							notes: null,
						},
					],
					sets: [],
					templates: [],
					settings: [],
					bodyEntries: [],
				},
			}),
			/Workout exercise record 1: notes must be text/,
		],
		[
			"an unknown weight unit",
			makeFile({
				data: {
					exercises: [],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [{ id: "app", weightUnit: "st", restSeconds: 90 }],
				},
			}),
			/Settings record 1: weightUnit must be "kg" or "lb"/,
		],
		[
			"a repeated id",
			makeFile({
				data: {
					exercises: [],
					workouts: [
						{ id: "w", name: "A", startedAt: T0 },
						{ id: "w", name: "B", startedAt: T0 },
					],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
				},
			}),
			/Workout record 2: id "w" appears twice/,
		],
		[
			"a body log entry with a time instead of a day",
			makeFile({
				data: {
					exercises: [],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
					bodyEntries: [{ id: "b", date: T0, bodyWeightKg: 70 }],
				},
			}),
			/Body log entry record 1: date must be a day \(YYYY-MM-DD\)/,
		],
		[
			"a body log measurement that is not a number",
			makeFile({
				data: {
					exercises: [],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
					bodyEntries: [{ id: "b", date: "2026-10-01", waistCm: "80" }],
				},
			}),
			/Body log entry record 1: waistCm must be a number/,
		],
		[
			"two body log entries for the same day",
			makeFile({
				data: {
					exercises: [],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
					bodyEntries: [
						{ id: "a", date: "2026-10-01", bodyWeightKg: 70 },
						{ id: "b", date: "2026-10-01", waistCm: 80 },
					],
				},
			}),
			/Two body log entries are for the same day \(2026-10-01\)/,
		],
		[
			"a current-version backup without the body log",
			makeFile({
				data: {
					exercises: [],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
				},
			}),
			/no list of "bodyEntries"/,
		],
		[
			"two exercises with the same name",
			makeFile({
				data: {
					exercises: [
						{ id: "a", name: "Row", nameKey: "row" },
						{ id: "b", name: "row", nameKey: "row" },
					],
					workouts: [],
					workoutExercises: [],
					sets: [],
					templates: [],
					settings: [],
					bodyEntries: [],
				},
			}),
			/same name/,
		],
	])("%s", (_name, text, reason) => {
		const parsed = parseBackup(text);
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) expect(parsed.reason).toMatch(reason);
	});
});

describe("recordLastBackup", () => {
	it("records the time, keeping the other settings", async () => {
		await saveSettings({ weightUnit: "lb" }, database);
		await recordLastBackup(T0, database);

		expect(await findSettings(database)).toMatchObject({
			weightUnit: "lb",
			lastBackupAt: T0,
		});
	});

	it("keeps a later backup time already recorded", async () => {
		await recordLastBackup(T0 + HOUR_MS, database);
		await recordLastBackup(T0, database);

		expect((await findSettings(database)).lastBackupAt).toBe(T0 + HOUR_MS);
	});
});
