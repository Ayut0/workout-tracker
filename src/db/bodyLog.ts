import { db, type WorkoutDB } from "./index";
import type { BodyEntry } from "./types";

/**
 * The body log (ADR-0015): one entry per local day with body weight and
 * waist. Saving a day replaces that day's measurements.
 */

/** What is saved for a day: the BodyEntry without its id. */
export type BodyEntryInput = Omit<BodyEntry, "id">;

const LOCAL_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A "YYYY-MM-DD" local day as epoch ms at local midnight; undefined when the
 * text is not a real calendar day (e.g. "2026-02-30").
 */
export function parseLocalDay(day: string): number | undefined {
	const match = LOCAL_DAY.exec(day);
	if (!match) return undefined;
	const [year, month, date] = match.slice(1).map(Number);
	if (year === undefined || month === undefined || date === undefined) {
		return undefined;
	}
	const midnight = new Date(year, month - 1, date);
	if (
		midnight.getFullYear() !== year ||
		midnight.getMonth() !== month - 1 ||
		midnight.getDate() !== date
	) {
		return undefined;
	}
	return midnight.getTime();
}

/** True for a "YYYY-MM-DD" text naming a real calendar day. */
export function isLocalDay(value: unknown): value is string {
	return typeof value === "string" && parseLocalDay(value) !== undefined;
}

/** Every body log entry, oldest day first. */
export async function listBodyEntries(
	database: WorkoutDB = db,
): Promise<BodyEntry[]> {
	return database.bodyEntries.orderBy("date").toArray();
}

/**
 * Saves a day's measurements. A day that already has an entry keeps its id
 * and gets exactly the given measurements: one left out is removed.
 */
export async function saveBodyEntry(
	input: BodyEntryInput,
	database: WorkoutDB = db,
): Promise<BodyEntry> {
	return database.transaction("rw", database.bodyEntries, async () => {
		const existing = await database.bodyEntries.get({ date: input.date });
		const entry: BodyEntry = {
			id: existing?.id ?? crypto.randomUUID(),
			date: input.date,
			...(input.bodyWeightKg === undefined
				? {}
				: { bodyWeightKg: input.bodyWeightKg }),
			...(input.waistCm === undefined ? {} : { waistCm: input.waistCm }),
		};
		await database.bodyEntries.put(entry);
		return entry;
	});
}

/** Deletes one body log entry; false when it was already gone. */
export async function deleteBodyEntry(
	id: string,
	database: WorkoutDB = db,
): Promise<boolean> {
	return database.transaction("rw", database.bodyEntries, async () => {
		if (!(await database.bodyEntries.get(id))) return false;
		await database.bodyEntries.delete(id);
		return true;
	});
}
