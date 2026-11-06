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
		{ id: "we-1", workoutId: "w-done", exerciseId: "ex-bench", order: 0 },
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
		exercises: [{ exerciseId: "ex-bench", sets: [{ weightKg: 80, reps: 5 }] }],
	});
	await saveSettings(
		{ weightUnit: "lb", restSeconds: 120, lastBackupAt: T0 },
		target,
	);
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
			schemaVersion: 2,
			exportedAt: T0 + 5,
		});
		expect(Object.keys(backup.data).sort()).toEqual([...BACKUP_STORES].sort());
		expect(backup.data.sets).toHaveLength(2);
		expect(backup.data.settings).toEqual([
			{ id: SETTINGS_ID, weightUnit: "lb", restSeconds: 120, lastBackupAt: T0 },
		]);
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
		});
		expect(preview.current).toEqual({
			exercises: 2,
			workouts: 2,
			workoutExercises: 2,
			sets: 2,
			templates: 1,
			settings: 1,
		});
		expect(preview.currentActive?.id).toBe("w-active");
		expect(preview.incomingActive?.id).toBe("w");
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
			/newer version of the app \(data version 3; this app reads up to 2\)/,
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
