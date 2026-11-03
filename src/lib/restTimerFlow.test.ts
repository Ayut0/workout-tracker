import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkoutDB } from "../db";
import { TIMER_STATUS } from "../db/types";
import {
	cancelRestTimer,
	startRestTimer,
	type TimerApi,
} from "./restTimerFlow";

let database: WorkoutDB;
let api: TimerApi;

beforeEach(async () => {
	database = new WorkoutDB(`test-${crypto.randomUUID()}`);
	await database.open();
	api = { schedule: vi.fn().mockResolvedValue(undefined), cancel: vi.fn() };
});

afterEach(async () => {
	await database.delete();
});

describe("startRestTimer", () => {
	it("stores a pending timer and schedules the push at its time", async () => {
		const timer = await startRestTimer(90, api, database, () => 10_000);

		expect(timer).toMatchObject({
			scheduledAt: 100_000,
			status: TIMER_STATUS.pending,
		});
		expect(api.schedule).toHaveBeenCalledWith(100_000);
		expect(await database.restTimers.get(timer.id)).toEqual(timer);
	});

	it("cancels older pending timers", async () => {
		await database.restTimers.add({
			id: "old",
			scheduledAt: 1,
			createdAt: 0,
			status: TIMER_STATUS.pending,
		});

		await startRestTimer(60, api, database);

		expect((await database.restTimers.get("old"))?.status).toBe(
			TIMER_STATUS.cancelled,
		);
	});

	it("marks the timer failed and rethrows when the worker call fails", async () => {
		api.schedule = vi.fn().mockRejectedValue(new Error("500"));

		await expect(startRestTimer(60, api, database)).rejects.toThrow("500");

		const [timer] = await database.restTimers.toArray();
		expect(timer).toMatchObject({ status: TIMER_STATUS.failed, error: "500" });
	});
});

describe("cancelRestTimer", () => {
	it("cancels on the worker, then on the device", async () => {
		const timer = await startRestTimer(60, api, database);

		await cancelRestTimer(timer, api, database);

		expect(api.cancel).toHaveBeenCalled();
		expect((await database.restTimers.get(timer.id))?.status).toBe(
			TIMER_STATUS.cancelled,
		);
	});

	it("keeps the timer pending when the worker call fails", async () => {
		const timer = await startRestTimer(60, api, database);
		api.cancel = vi.fn().mockRejectedValue(new Error("offline"));

		await expect(cancelRestTimer(timer, api, database)).rejects.toThrow();

		expect((await database.restTimers.get(timer.id))?.status).toBe(
			TIMER_STATUS.pending,
		);
	});
});
