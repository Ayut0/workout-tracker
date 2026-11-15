import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	deleteBodyEntry,
	isLocalDay,
	listBodyEntries,
	parseLocalDay,
	saveBodyEntry,
} from "./bodyLog";
import { WorkoutDB } from "./index";

let database: WorkoutDB;

beforeEach(async () => {
	database = new WorkoutDB(`test-${crypto.randomUUID()}`);
	await database.open();
});

afterEach(async () => {
	await database.delete();
});

describe("local days", () => {
	it("reads a day as local midnight", () => {
		expect(parseLocalDay("2026-03-09")).toBe(new Date(2026, 2, 9).getTime());
	});

	it.each(["2026-02-30", "2026-13-01", "2026-3-9", "2026-03-09T00:00", ""])(
		"rejects %j",
		(text) => {
			expect(parseLocalDay(text)).toBeUndefined();
			expect(isLocalDay(text)).toBe(false);
		},
	);

	it("accepts only strings", () => {
		expect(isLocalDay("2024-02-29")).toBe(true);
		expect(isLocalDay(20240229)).toBe(false);
	});
});

describe("body log", () => {
	it("lists entries oldest day first", async () => {
		await saveBodyEntry({ date: "2026-03-10", bodyWeightKg: 71 }, database);
		await saveBodyEntry({ date: "2026-01-02", waistCm: 80 }, database);
		await saveBodyEntry({ date: "2026-02-15", bodyWeightKg: 70.5 }, database);

		expect((await listBodyEntries(database)).map((e) => e.date)).toEqual([
			"2026-01-02",
			"2026-02-15",
			"2026-03-10",
		]);
	});

	it("saves a new day with only the given measurements", async () => {
		const entry = await saveBodyEntry(
			{ date: "2026-01-02", waistCm: 80 },
			database,
		);

		expect(entry).toEqual({ id: entry.id, date: "2026-01-02", waistCm: 80 });
		expect(await database.bodyEntries.get(entry.id)).toEqual(entry);
		expect("bodyWeightKg" in entry).toBe(false);
	});

	it("replaces a day's measurements, keeping its id: one entry per day", async () => {
		const first = await saveBodyEntry(
			{ date: "2026-01-02", bodyWeightKg: 70, waistCm: 80 },
			database,
		);
		const second = await saveBodyEntry(
			{ date: "2026-01-02", bodyWeightKg: 69.5 },
			database,
		);

		expect(second).toEqual({
			id: first.id,
			date: "2026-01-02",
			bodyWeightKg: 69.5,
		});
		expect(await listBodyEntries(database)).toEqual([second]);
	});

	it("rejects a second record for the same day at the index", async () => {
		await database.bodyEntries.add({ id: "a", date: "2026-01-02" });
		await expect(
			database.bodyEntries.add({ id: "b", date: "2026-01-02" }),
		).rejects.toThrow();
	});

	it("deletes an entry and reports whether it existed", async () => {
		const entry = await saveBodyEntry(
			{ date: "2026-01-02", bodyWeightKg: 70 },
			database,
		);

		expect(await deleteBodyEntry(entry.id, database)).toBe(true);
		expect(await database.bodyEntries.count()).toBe(0);
		expect(await deleteBodyEntry(entry.id, database)).toBe(false);
	});
});
