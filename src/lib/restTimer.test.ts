import { describe, expect, it } from "vitest";
import { type RestTimer, TIMER_STATUS } from "../db/types";
import {
	ACTIVE_GRACE_MS,
	findActiveTimer,
	formatCountdown,
	formatOutcome,
	getTimerOutcome,
	OUTCOME_KIND,
} from "./restTimer";

const base: RestTimer = {
	id: "t",
	scheduledAt: 100_000,
	createdAt: 10_000,
	status: TIMER_STATUS.pending,
};

describe("getTimerOutcome", () => {
	it("reports the delay of a received push", () => {
		const outcome = getTimerOutcome(
			{ ...base, status: TIMER_STATUS.received, receivedAt: 102_400 },
			200_000,
		);
		expect(outcome).toEqual({ kind: OUTCOME_KIND.received, delaySec: 2.4 });
		expect(formatOutcome(outcome)).toBe("Arrived +2.4s");
	});

	it("shows an early push with a minus sign", () => {
		const outcome = getTimerOutcome(
			{ ...base, status: TIMER_STATUS.received, receivedAt: 99_500 },
			200_000,
		);
		expect(formatOutcome(outcome)).toBe("Arrived −0.5s");
	});

	it("keeps a pending timer waiting for a minute after its time, then calls it lost", () => {
		expect(getTimerOutcome(base, 160_000)).toEqual({
			kind: OUTCOME_KIND.waiting,
		});
		expect(getTimerOutcome(base, 160_001)).toEqual({ kind: OUTCOME_KIND.lost });
	});

	it("passes through cancelled and failed timers", () => {
		expect(
			getTimerOutcome({ ...base, status: TIMER_STATUS.cancelled }, 0),
		).toEqual({
			kind: OUTCOME_KIND.cancelled,
		});
		expect(
			getTimerOutcome(
				{ ...base, status: TIMER_STATUS.failed, error: "500" },
				0,
			),
		).toEqual({
			kind: OUTCOME_KIND.failed,
			error: "500",
		});
	});
});

describe("formatCountdown", () => {
	it.each([
		[90_000, "1:30"],
		[59_001, "1:00"],
		[5_000, "0:05"],
		[0, "0:00"],
		[-3_000, "0:00"],
	])("formats %i ms as %s", (ms, text) => {
		expect(formatCountdown(ms)).toBe(text);
	});
});

describe("findActiveTimer", () => {
	it("keeps a pending timer active until the grace window after its time", () => {
		expect(findActiveTimer([base], 100_000 + ACTIVE_GRACE_MS - 1)).toBe(base);
		expect(findActiveTimer([base], 100_000 + ACTIVE_GRACE_MS + 1)).toBe(
			undefined,
		);
	});

	it("ignores timers that are not pending", () => {
		const received = { ...base, status: TIMER_STATUS.received };
		expect(findActiveTimer([received], 0)).toBeUndefined();
	});
});
