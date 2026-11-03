import { db, type WorkoutDB } from "../db";
import { type RestTimer, TIMER_STATUS } from "../db/types";

/** The notification worker, bound to this device's push subscription. */
export interface TimerApi {
	schedule(fireAt: number): Promise<void>;
	cancel(): Promise<void>;
}

/**
 * Records a pending timer and asks the worker to push at its time.
 * The worker keeps one timer per device, so older pending ones are cancelled
 * here too. If the worker call fails the timer is marked failed and the error
 * is rethrown.
 */
export async function startRestTimer(
	seconds: number,
	api: TimerApi,
	database: WorkoutDB = db,
	now: () => number = Date.now,
): Promise<RestTimer> {
	const createdAt = now();
	const timer: RestTimer = {
		id: crypto.randomUUID(),
		scheduledAt: createdAt + seconds * 1000,
		createdAt,
		status: TIMER_STATUS.pending,
	};
	await database.restTimers
		.where("status")
		.equals(TIMER_STATUS.pending)
		.modify({ status: TIMER_STATUS.cancelled });
	await database.restTimers.add(timer);
	try {
		await api.schedule(timer.scheduledAt);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		await database.restTimers.update(timer.id, {
			status: TIMER_STATUS.failed,
			error: message,
		});
		throw e;
	}
	return timer;
}

/** Cancels the push on the worker, then the timer on the device. */
export async function cancelRestTimer(
	timer: RestTimer,
	api: TimerApi,
	database: WorkoutDB = db,
): Promise<void> {
	await api.cancel();
	await database.restTimers.update(timer.id, {
		status: TIMER_STATUS.cancelled,
	});
}
