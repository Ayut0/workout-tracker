import { describe, expect, it } from "vitest";
import type { RestTimer } from "../db/types";
import { formatCountdown, outcomeLabel, timerOutcome } from "./restTimer";

const base: RestTimer = {
	id: "t",
	scheduledAt: 100_000,
	createdAt: 10_000,
	status: "pending",
};

describe("timerOutcome", () => {
	it("reports the delay of a received push", () => {
		const outcome = timerOutcome(
			{ ...base, status: "received", receivedAt: 102_400 },
			200_000,
		);
		expect(outcome).toEqual({ kind: "received", delaySec: 2.4 });
		expect(outcomeLabel(outcome)).toBe("Arrived +2.4s");
	});

	it("shows an early push with a minus sign", () => {
		const outcome = timerOutcome(
			{ ...base, status: "received", receivedAt: 99_500 },
			200_000,
		);
		expect(outcomeLabel(outcome)).toBe("Arrived −0.5s");
	});

	it("keeps a pending timer waiting for a minute after its time, then calls it lost", () => {
		expect(timerOutcome(base, 160_000)).toEqual({ kind: "waiting" });
		expect(timerOutcome(base, 160_001)).toEqual({ kind: "lost" });
	});

	it("passes through cancelled and failed timers", () => {
		expect(timerOutcome({ ...base, status: "cancelled" }, 0)).toEqual({
			kind: "cancelled",
		});
		expect(
			timerOutcome({ ...base, status: "failed", error: "500" }, 0),
		).toEqual({
			kind: "failed",
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
