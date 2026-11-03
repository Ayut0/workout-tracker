import type { RestTimer } from "../db/types";

/** A push not seen this long after its time is counted as lost. */
export const LOST_AFTER_MS = 60_000;

/**
 * How long the countdown stays on screen after its time, so the timer does not
 * flip back to "Start" while the push is still in flight.
 */
export const ACTIVE_GRACE_MS = 1_000;

export type TimerOutcome =
	| { kind: "waiting" }
	| { kind: "received"; delaySec: number }
	| { kind: "lost" }
	| { kind: "cancelled" }
	| { kind: "failed"; error: string };

export function timerOutcome(timer: RestTimer, now: number): TimerOutcome {
	switch (timer.status) {
		case "received":
			return {
				kind: "received",
				delaySec:
					((timer.receivedAt ?? timer.scheduledAt) - timer.scheduledAt) / 1000,
			};
		case "cancelled":
			return { kind: "cancelled" };
		case "failed":
			return { kind: "failed", error: timer.error ?? "" };
		case "pending":
			return now - timer.scheduledAt > LOST_AFTER_MS
				? { kind: "lost" }
				: { kind: "waiting" };
	}
}

export function outcomeLabel(outcome: TimerOutcome): string {
	switch (outcome.kind) {
		case "waiting":
			return "Waiting";
		case "received": {
			const sign = outcome.delaySec >= 0 ? "+" : "−";
			return `Arrived ${sign}${Math.abs(outcome.delaySec).toFixed(1)}s`;
		}
		case "lost":
			return "Lost";
		case "cancelled":
			return "Cancelled";
		case "failed":
			return "Failed to send";
	}
}

/** "1:30" style countdown text; never negative. */
export function formatCountdown(ms: number): string {
	const total = Math.max(0, Math.ceil(ms / 1000));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** The pending timer the screen is counting down, if any. */
export function findActiveTimer(
	timers: readonly RestTimer[],
	now: number,
): RestTimer | undefined {
	return timers.find(
		(t) => t.status === "pending" && t.scheduledAt > now - ACTIVE_GRACE_MS,
	);
}
