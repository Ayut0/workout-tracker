import { type RestTimer, TIMER_STATUS } from "../db/types";

/** A push not seen this long after its time is counted as lost. */
export const LOST_AFTER_MS = 60_000;

/**
 * How long the countdown stays on screen after its time, so the timer does not
 * flip back to "Start" while the push is still in flight.
 */
export const ACTIVE_GRACE_MS = 1_000;

/**
 * What the log shows for a timer. Mostly the stored status, except that a
 * pending timer is "waiting" until LOST_AFTER_MS has passed, then "lost".
 */
export const OUTCOME_KIND = {
	waiting: "waiting",
	received: "received",
	lost: "lost",
	cancelled: "cancelled",
	failed: "failed",
} as const satisfies Record<string, string>;

export type TimerOutcome =
	| { kind: typeof OUTCOME_KIND.waiting }
	| { kind: typeof OUTCOME_KIND.received; delaySec: number }
	| { kind: typeof OUTCOME_KIND.lost }
	| { kind: typeof OUTCOME_KIND.cancelled }
	| { kind: typeof OUTCOME_KIND.failed; error: string };

export function getTimerOutcome(timer: RestTimer, now: number): TimerOutcome {
	switch (timer.status) {
		case TIMER_STATUS.received:
			return {
				kind: OUTCOME_KIND.received,
				delaySec:
					((timer.receivedAt ?? timer.scheduledAt) - timer.scheduledAt) / 1000,
			};
		case TIMER_STATUS.cancelled:
			return { kind: OUTCOME_KIND.cancelled };
		case TIMER_STATUS.failed:
			return { kind: OUTCOME_KIND.failed, error: timer.error ?? "" };
		case TIMER_STATUS.pending:
			return now - timer.scheduledAt > LOST_AFTER_MS
				? { kind: OUTCOME_KIND.lost }
				: { kind: OUTCOME_KIND.waiting };
	}
}

export function formatOutcome(outcome: TimerOutcome): string {
	switch (outcome.kind) {
		case OUTCOME_KIND.waiting:
			return "Waiting";
		case OUTCOME_KIND.received: {
			const sign = outcome.delaySec >= 0 ? "+" : "−";
			return `Arrived ${sign}${Math.abs(outcome.delaySec).toFixed(1)}s`;
		}
		case OUTCOME_KIND.lost:
			return "Lost";
		case OUTCOME_KIND.cancelled:
			return "Cancelled";
		case OUTCOME_KIND.failed:
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
		(t) =>
			t.status === TIMER_STATUS.pending &&
			t.scheduledAt > now - ACTIVE_GRACE_MS,
	);
}
