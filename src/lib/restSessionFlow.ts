/**
 * The rest after a completed set, with its side effects: the countdown ends at
 * its time, and the lock-screen push follows every change through TimerApi.
 */
import { db, type WorkoutDB } from "../db";
import {
	currentSubscription,
	isConfigured,
	permissionState,
	timerApiFor,
} from "./push";
import {
	findPushBlocker,
	PUSH_BLOCKER,
	type PushBlocker,
	type RestAction,
	type RestState,
	reduceRest,
} from "./restSession";
import {
	cancelPendingRestTimers,
	startRestTimerAt,
	type TimerApi,
} from "./restTimerFlow";
import { readSubscription } from "./setupState";

/** The worker for this device, or why there is none. */
export type TimerConnection = { api: TimerApi } | { blocker: PushBlocker };

export interface RestSnapshot {
	rest: RestState;
	/** Why the last sync could send no push; null when it could, or before any. */
	pushBlocker: PushBlocker | null;
	/** The last push call's error, until one succeeds. */
	pushError: string | null;
}

export interface RestSession {
	getSnapshot(): RestSnapshot;
	subscribe(listener: () => void): () => void;
	/** Applies the action now; resolves once the push matches the result. */
	dispatch(action: RestAction): Promise<void>;
	dispose(): void;
}

type RestSessionDeps = {
	connect: () => Promise<TimerConnection>;
	database?: WorkoutDB;
	now?: () => number;
};

/**
 * Pushes are synced one at a time, in order, and each sync works towards the
 * latest state: rapid −15 / +15 taps cost one worker call, not one per tap,
 * and calls never arrive out of order.
 */
export function createRestSession({
	connect,
	database = db,
	now = () => Date.now(),
}: RestSessionDeps): RestSession {
	let snapshot: RestSnapshot = {
		rest: null,
		pushBlocker: null,
		pushError: null,
	};
	const listeners = new Set<() => void>();
	let queue = Promise.resolve();
	let expiry: ReturnType<typeof setTimeout> | undefined;
	/** The fire time the worker holds for us, if we scheduled one. */
	let scheduledFor: number | null = null;

	function update(changes: Partial<RestSnapshot>) {
		snapshot = { ...snapshot, ...changes };
		for (const listener of listeners) listener();
	}

	function armExpiry(rest: RestState) {
		clearTimeout(expiry);
		expiry = undefined;
		if (!rest) return;
		expiry = setTimeout(
			() => void dispatch({ type: "expire", now: now() }),
			Math.max(0, rest.endsAt - now()),
		);
	}

	async function sync() {
		try {
			const connection = await connect();
			if ("blocker" in connection) {
				scheduledFor = null;
				update({ pushBlocker: connection.blocker, pushError: null });
				return;
			}
			const target = snapshot.rest;
			if (target) {
				if (target.endsAt !== scheduledFor) {
					scheduledFor = null;
					await startRestTimerAt(target.endsAt, connection.api, database, now);
					scheduledFor = target.endsAt;
				}
			} else {
				scheduledFor = null;
				await cancelPendingRestTimers(connection.api, database, now);
			}
			update({ pushBlocker: null, pushError: null });
		} catch (e) {
			update({ pushError: e instanceof Error ? e.message : String(e) });
		}
	}

	function dispatch(action: RestAction): Promise<void> {
		const previous = snapshot.rest;
		const next = reduceRest(previous, action);
		if (next !== previous) {
			update({ rest: next });
			armExpiry(next);
		}
		if (action.type === "expire") {
			// The push fires by itself at this time; nothing to cancel.
			if (next === null) scheduledFor = null;
			return queue;
		}
		// Ending a workout also cancels a push whose countdown is gone (e.g. after a reload).
		if (next !== previous || action.type === "workoutEnded") {
			queue = queue.then(sync);
		}
		return queue;
	}

	return {
		getSnapshot: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		dispatch,
		dispose() {
			clearTimeout(expiry);
			listeners.clear();
		},
	};
}

/** The worker bound to this device's push subscription, or why there is none. */
export async function connectTimerApi(): Promise<TimerConnection> {
	// Check what needs no service worker first, then read the subscription.
	const blocker = findPushBlocker({
		configured: isConfigured(),
		permission: permissionState(),
		subscribed: true,
	});
	if (blocker) return { blocker };
	const subscription = await readSubscription(currentSubscription);
	return subscription
		? { api: timerApiFor(subscription) }
		: { blocker: PUSH_BLOCKER.notEnabled };
}
