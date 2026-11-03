import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findLatestPendingTimer, markTimerReceived, WorkoutDB } from "./index";
import { TIMER_STATUS } from "./types";

let database: WorkoutDB;

beforeEach(async () => {
	database = new WorkoutDB(`test-${crypto.randomUUID()}`);
	await database.open();
});

afterEach(async () => {
	await database.delete();
});

describe("rest timers", () => {
	it("marks the newest pending timer as received", async () => {
		await database.restTimers.bulkAdd([
			{
				id: "old",
				scheduledAt: 1_000,
				createdAt: 0,
				status: TIMER_STATUS.pending,
			},
			{
				id: "new",
				scheduledAt: 2_000,
				createdAt: 0,
				status: TIMER_STATUS.pending,
			},
			{
				id: "done",
				scheduledAt: 3_000,
				createdAt: 0,
				status: TIMER_STATUS.cancelled,
			},
		]);

		expect((await findLatestPendingTimer(database))?.id).toBe("new");

		const received = await markTimerReceived(2_400, database);
		expect(received?.id).toBe("new");
		expect(await database.restTimers.get("new")).toMatchObject({
			status: TIMER_STATUS.received,
			receivedAt: 2_400,
		});
	});

	it("returns undefined when nothing is pending", async () => {
		expect(await markTimerReceived(1, database)).toBeUndefined();
	});
});
