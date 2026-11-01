import Dexie, { type EntityTable } from "dexie";
import type { RestTimer } from "./types";

export const DB_NAME = "workout-tracker";

export class WorkoutDB extends Dexie {
	restTimers!: EntityTable<RestTimer, "id">;

	constructor(name = DB_NAME) {
		super(name);
		// Only indexed fields are listed; other fields are stored as-is.
		// A schema change means a new this.version(n) block, never editing this one:
		// phones that already ran version 1 upgrade from it.
		this.version(1).stores({
			restTimers: "id, scheduledAt, status",
		});
	}
}

export const db = new WorkoutDB();

/** Returns the most recent pending timer, the one a push just arrived for. */
export async function latestPendingTimer(
	database: WorkoutDB = db,
): Promise<RestTimer | undefined> {
	return database.restTimers
		.where("status")
		.equals("pending")
		.reverse()
		.sortBy("scheduledAt")
		.then((timers) => timers[0]);
}

/** Marks the latest pending timer as received now; returns it, if any. */
export async function markTimerReceived(
	receivedAt: number,
	database: WorkoutDB = db,
): Promise<RestTimer | undefined> {
	const timer = await latestPendingTimer(database);
	if (!timer) return undefined;
	await database.restTimers.update(timer.id, {
		status: "received",
		receivedAt,
	});
	return { ...timer, status: "received", receivedAt };
}
