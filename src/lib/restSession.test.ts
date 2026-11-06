import { describe, expect, it } from "vitest";
import { PERMISSION } from "./push";
import { MAX_REST_SECONDS } from "./restDuration";
import {
	describePushBlocker,
	findPushBlocker,
	PUSH_BLOCKER,
	type Rest,
	reduceRest,
	remainingRestMs,
	restActionsForLog,
	restProgress,
} from "./restSession";

const resting: Rest = { setId: "s1", startedAt: 0, endsAt: 90_000 };

describe("reduceRest", () => {
	it("starts a rest of the given seconds from now", () => {
		expect(
			reduceRest(null, { type: "start", setId: "s1", seconds: 90, now: 0 }),
		).toEqual(resting);
	});

	it("replaces the running rest when another set is completed", () => {
		expect(
			reduceRest(resting, {
				type: "start",
				setId: "s2",
				seconds: 60,
				now: 30_000,
			}),
		).toEqual({ setId: "s2", startedAt: 30_000, endsAt: 90_000 });
	});

	it("adds and removes 15 seconds", () => {
		expect(
			reduceRest(resting, { type: "adjust", deltaSeconds: 15, now: 10_000 }),
		).toEqual({ ...resting, endsAt: 105_000 });
		expect(
			reduceRest(resting, { type: "adjust", deltaSeconds: -15, now: 10_000 }),
		).toEqual({ ...resting, endsAt: 75_000 });
	});

	it("ends the rest when −15 s would leave none", () => {
		expect(
			reduceRest(resting, { type: "adjust", deltaSeconds: -15, now: 80_000 }),
		).toBeNull();
	});

	it("never adds beyond the longest rest", () => {
		const next = reduceRest(resting, {
			type: "adjust",
			deltaSeconds: MAX_REST_SECONDS,
			now: 0,
		});
		expect(next?.endsAt).toBe(MAX_REST_SECONDS * 1000);
	});

	it("ignores adjust, skip and expire when not resting", () => {
		expect(
			reduceRest(null, { type: "adjust", deltaSeconds: 15, now: 0 }),
		).toBeNull();
		expect(reduceRest(null, { type: "skip" })).toBeNull();
		expect(reduceRest(null, { type: "expire", now: 0 })).toBeNull();
	});

	it("skips the rest", () => {
		expect(reduceRest(resting, { type: "skip" })).toBeNull();
	});

	it("expires only once the time is up", () => {
		expect(reduceRest(resting, { type: "expire", now: 89_999 })).toBe(resting);
		expect(reduceRest(resting, { type: "expire", now: 90_000 })).toBeNull();
	});

	it("cancels when the set that started the rest is no longer done", () => {
		expect(reduceRest(resting, { type: "setUndone", setId: "s1" })).toBeNull();
		expect(reduceRest(resting, { type: "setUndone", setId: "s2" })).toBe(
			resting,
		);
	});

	it("cancels when the workout ends", () => {
		expect(reduceRest(resting, { type: "workoutEnded" })).toBeNull();
	});
});

describe("remainingRestMs and restProgress", () => {
	it("counts down to zero, never below", () => {
		expect(remainingRestMs(resting, 30_000)).toBe(60_000);
		expect(remainingRestMs(resting, 100_000)).toBe(0);
	});

	it("is the share of the rest still to go", () => {
		expect(restProgress(resting, 45_000)).toBe(0.5);
		expect(restProgress(resting, 100_000)).toBe(0);
	});
});

describe("restActionsForLog", () => {
	it("ends the rest when the active workout ends or changes", () => {
		expect(restActionsForLog("w1", { activeWorkoutId: null }, resting)).toEqual(
			[{ type: "workoutEnded" }],
		);
		expect(restActionsForLog("w1", { activeWorkoutId: "w2" }, null)).toEqual([
			{ type: "workoutEnded" },
		]);
	});

	it("does nothing when a workout starts or keeps going", () => {
		expect(restActionsForLog(null, { activeWorkoutId: "w1" }, null)).toEqual(
			[],
		);
		expect(
			restActionsForLog(
				"w1",
				{ activeWorkoutId: "w1", set: { id: "s1", done: true } },
				resting,
			),
		).toEqual([]);
	});

	it("cancels when the resting set was uncompleted or removed", () => {
		expect(
			restActionsForLog(
				"w1",
				{ activeWorkoutId: "w1", set: { id: "s1", done: false } },
				resting,
			),
		).toEqual([{ type: "setUndone", setId: "s1" }]);
	});

	it("ignores a stale read for another set", () => {
		expect(
			restActionsForLog(
				"w1",
				{ activeWorkoutId: "w1", set: { id: "old", done: false } },
				resting,
			),
		).toEqual([]);
	});
});

describe("findPushBlocker", () => {
	const ready = {
		configured: true,
		permission: PERMISSION.granted,
		subscribed: true,
	};

	it("is null when pushes can be sent", () => {
		expect(findPushBlocker(ready)).toBeNull();
	});

	it("names the first reason there is no push", () => {
		expect(findPushBlocker({ ...ready, configured: false })).toBe(
			PUSH_BLOCKER.unconfigured,
		);
		expect(
			findPushBlocker({ ...ready, permission: PERMISSION.unsupported }),
		).toBe(PUSH_BLOCKER.unsupported);
		expect(findPushBlocker({ ...ready, permission: PERMISSION.denied })).toBe(
			PUSH_BLOCKER.denied,
		);
		expect(findPushBlocker({ ...ready, permission: PERMISSION.default })).toBe(
			PUSH_BLOCKER.notEnabled,
		);
		expect(findPushBlocker({ ...ready, subscribed: false })).toBe(
			PUSH_BLOCKER.notEnabled,
		);
	});

	it("describes every reason", () => {
		for (const blocker of Object.values(PUSH_BLOCKER)) {
			expect(describePushBlocker(blocker)).not.toBe("");
		}
	});
});
