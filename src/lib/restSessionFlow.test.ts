import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkoutDB } from "../db";
import { TIMER_STATUS } from "../db/types";
import { PUSH_BLOCKER } from "./restSession";
import {
	createRestSession,
	type RestSession,
	type TimerConnection,
} from "./restSessionFlow";
import type { TimerApi } from "./restTimerFlow";

let database: WorkoutDB;
let api: TimerApi & {
	schedule: ReturnType<typeof vi.fn>;
	cancel: ReturnType<typeof vi.fn>;
};
let connection: TimerConnection;
let clock: number;
let session: RestSession;

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
	database = new WorkoutDB(`test-${crypto.randomUUID()}`);
	await database.open();
	api = {
		schedule: vi.fn().mockResolvedValue(undefined),
		cancel: vi.fn().mockResolvedValue(undefined),
	};
	connection = { api };
	clock = 0;
	session = createRestSession({
		connect: async () => connection,
		database,
		now: () => clock,
	});
});

afterEach(async () => {
	session.dispose();
	vi.useRealTimers();
	await database.delete();
});

function pendingTimers() {
	return database.restTimers
		.where("status")
		.equals(TIMER_STATUS.pending)
		.toArray();
}

describe("createRestSession", () => {
	it("starts the countdown and schedules the push for its end", async () => {
		await session.dispatch({ type: "start", setId: "s1", seconds: 90, now: 0 });

		expect(session.getSnapshot().rest).toEqual({
			setId: "s1",
			startedAt: 0,
			endsAt: 90_000,
		});
		expect(api.schedule).toHaveBeenCalledWith(90_000);
		expect(await pendingTimers()).toMatchObject([{ scheduledAt: 90_000 }]);
	});

	it("replaces the pending timer when another set is completed", async () => {
		await session.dispatch({ type: "start", setId: "s1", seconds: 90, now: 0 });
		clock = 20_000;
		await session.dispatch({
			type: "start",
			setId: "s2",
			seconds: 60,
			now: 20_000,
		});

		expect(session.getSnapshot().rest?.setId).toBe("s2");
		// The worker keeps one timer per device: scheduling again replaces it.
		expect(api.schedule).toHaveBeenLastCalledWith(80_000);
		expect(await pendingTimers()).toMatchObject([{ scheduledAt: 80_000 }]);
		expect(await database.restTimers.count()).toBe(2);
	});

	it("reschedules the push when the rest is adjusted", async () => {
		await session.dispatch({ type: "start", setId: "s1", seconds: 90, now: 0 });
		await session.dispatch({ type: "adjust", deltaSeconds: 15, now: 0 });
		await session.dispatch({ type: "adjust", deltaSeconds: -15, now: 0 });
		await session.dispatch({ type: "adjust", deltaSeconds: -15, now: 0 });

		expect(session.getSnapshot().rest?.endsAt).toBe(75_000);
		expect(api.schedule.mock.calls).toEqual([
			[90_000],
			[105_000],
			[90_000],
			[75_000],
		]);
		expect(await pendingTimers()).toMatchObject([{ scheduledAt: 75_000 }]);
	});

	it("sends one push for rapid taps, at the latest time", async () => {
		await session.dispatch({ type: "start", setId: "s1", seconds: 90, now: 0 });
		api.schedule.mockClear();

		void session.dispatch({ type: "adjust", deltaSeconds: 15, now: 0 });
		void session.dispatch({ type: "adjust", deltaSeconds: 15, now: 0 });
		await session.dispatch({ type: "adjust", deltaSeconds: 15, now: 0 });

		expect(api.schedule.mock.calls).toEqual([[135_000]]);
	});

	it.each([
		{ name: "skip", action: { type: "skip" } as const },
		{ name: "finish or discard", action: { type: "workoutEnded" } as const },
		{
			name: "uncompleting the set",
			action: { type: "setUndone", setId: "s1" } as const,
		},
	])("cancels the push on $name", async ({ action }) => {
		await session.dispatch({ type: "start", setId: "s1", seconds: 90, now: 0 });
		clock = 10_000;

		await session.dispatch(action);

		expect(session.getSnapshot().rest).toBeNull();
		expect(api.cancel).toHaveBeenCalledOnce();
		expect(await pendingTimers()).toEqual([]);
	});

	it("cancels the push when −15 s leaves no rest", async () => {
		await session.dispatch({ type: "start", setId: "s1", seconds: 10, now: 0 });

		await session.dispatch({ type: "adjust", deltaSeconds: -15, now: 0 });

		expect(session.getSnapshot().rest).toBeNull();
		expect(api.cancel).toHaveBeenCalledOnce();
	});

	it("keeps the rest when another set is uncompleted", async () => {
		await session.dispatch({ type: "start", setId: "s1", seconds: 90, now: 0 });

		await session.dispatch({ type: "setUndone", setId: "other" });

		expect(session.getSnapshot().rest?.setId).toBe("s1");
		expect(api.cancel).not.toHaveBeenCalled();
	});

	it("cancels a pending push when the workout ends, even with no countdown", async () => {
		// E.g. the app was reloaded mid-rest: the push is pending, the countdown is gone.
		await database.restTimers.add({
			id: "t",
			scheduledAt: 60_000,
			createdAt: 0,
			status: TIMER_STATUS.pending,
		});

		await session.dispatch({ type: "workoutEnded" });

		expect(api.cancel).toHaveBeenCalledOnce();
		expect(await pendingTimers()).toEqual([]);
	});

	it("ends the countdown at its time without cancelling the push", async () => {
		const changes = vi.fn();
		session.subscribe(changes);
		await session.dispatch({ type: "start", setId: "s1", seconds: 90, now: 0 });

		clock = 90_000;
		await vi.advanceTimersByTimeAsync(90_000);

		expect(session.getSnapshot().rest).toBeNull();
		expect(changes).toHaveBeenCalled();
		expect(api.cancel).not.toHaveBeenCalled();
		expect(await pendingTimers()).toHaveLength(1);
	});

	it("counts down without a push, and says why", async () => {
		connection = { blocker: PUSH_BLOCKER.denied };

		await session.dispatch({ type: "start", setId: "s1", seconds: 90, now: 0 });

		expect(session.getSnapshot()).toMatchObject({
			rest: { endsAt: 90_000 },
			pushBlocker: PUSH_BLOCKER.denied,
		});
		expect(await database.restTimers.count()).toBe(0);
	});

	it("keeps counting down and reports the error when the push fails", async () => {
		api.schedule.mockRejectedValue(new Error("offline"));

		await session.dispatch({ type: "start", setId: "s1", seconds: 90, now: 0 });

		expect(session.getSnapshot()).toMatchObject({
			rest: { endsAt: 90_000 },
			pushError: "offline",
		});

		api.schedule.mockResolvedValue(undefined);
		await session.dispatch({ type: "adjust", deltaSeconds: 15, now: 0 });
		expect(session.getSnapshot().pushError).toBeNull();
	});
});
