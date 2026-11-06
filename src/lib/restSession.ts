/**
 * The rest after a completed set, as a pure state machine: what the Workout
 * screen counts down. Pushes are synced from it by restSessionFlow.
 */
import type { RestWatch } from "../db/restWatch";
import { PERMISSION, type PermissionState } from "./push";
import { MAX_REST_SECONDS } from "./restDuration";

const MS_PER_SECOND = 1000;

/** What −15 s / +15 s change the rest by. */
export const REST_ADJUST_SECONDS = 15;

/** A rest in progress, started by completing the set `setId`. */
export interface Rest {
	setId: string;
	startedAt: number;
	/** When the rest is over (epoch ms); the push is scheduled for this time. */
	endsAt: number;
}

export type RestState = Rest | null;

export type RestAction =
	/** A set was completed: start its rest, replacing any running one. */
	| { type: "start"; setId: string; seconds: number; now: number }
	| { type: "adjust"; deltaSeconds: number; now: number }
	| { type: "skip" }
	/** The time is up; the push (if any) fires by itself. */
	| { type: "expire"; now: number }
	/** The set was uncompleted or removed. */
	| { type: "setUndone"; setId: string }
	/** The workout was finished or discarded. */
	| { type: "workoutEnded" };

export function reduceRest(state: RestState, action: RestAction): RestState {
	switch (action.type) {
		case "start":
			return {
				setId: action.setId,
				startedAt: action.now,
				endsAt: action.now + action.seconds * MS_PER_SECOND,
			};
		case "adjust": {
			if (!state) return null;
			const endsAt = Math.min(
				state.endsAt + action.deltaSeconds * MS_PER_SECOND,
				action.now + MAX_REST_SECONDS * MS_PER_SECOND,
			);
			return endsAt <= action.now ? null : { ...state, endsAt };
		}
		case "expire":
			return state && state.endsAt <= action.now ? null : state;
		case "setUndone":
			return state?.setId === action.setId ? null : state;
		case "skip":
		case "workoutEnded":
			return null;
	}
}

export function remainingRestMs(rest: Rest, now: number): number {
	return Math.max(0, rest.endsAt - now);
}

/** The share of the rest still to go, from 1 down to 0. */
export function restProgress(rest: Rest, now: number): number {
	const total = rest.endsAt - rest.startedAt;
	return total > 0 ? remainingRestMs(rest, now) / total : 0;
}

/**
 * The actions a change in the workout log implies: the active workout ending
 * (finished, discarded, or replaced) ends the rest, and the rest's set being
 * uncompleted or removed cancels it.
 */
export function restActionsForLog(
	previousWorkoutId: string | null,
	observed: RestWatch,
	rest: RestState,
): RestAction[] {
	const actions: RestAction[] = [];
	if (
		previousWorkoutId !== null &&
		observed.activeWorkoutId !== previousWorkoutId
	) {
		actions.push({ type: "workoutEnded" });
	}
	if (rest && observed.set?.id === rest.setId && !observed.set.done) {
		actions.push({ type: "setUndone", setId: rest.setId });
	}
	return actions;
}

/** Why no lock-screen push can be sent for a rest. */
export type PushBlocker =
	| "unconfigured"
	| "unsupported"
	| "denied"
	| "notEnabled";

export const PUSH_BLOCKER = {
	unconfigured: "unconfigured",
	unsupported: "unsupported",
	denied: "denied",
	notEnabled: "notEnabled",
} as const satisfies { [B in PushBlocker]: B };

export function findPushBlocker(state: {
	configured: boolean;
	permission: PermissionState;
	subscribed: boolean;
}): PushBlocker | null {
	if (!state.configured) return PUSH_BLOCKER.unconfigured;
	switch (state.permission) {
		case PERMISSION.unsupported:
			return PUSH_BLOCKER.unsupported;
		case PERMISSION.denied:
			return PUSH_BLOCKER.denied;
		case PERMISSION.default:
			return PUSH_BLOCKER.notEnabled;
		case PERMISSION.granted:
			return state.subscribed ? null : PUSH_BLOCKER.notEnabled;
	}
}

export function describePushBlocker(blocker: PushBlocker): string {
	switch (blocker) {
		case PUSH_BLOCKER.unconfigured:
			return "No lock-screen alert: this build has no notification server set up.";
		case PUSH_BLOCKER.unsupported:
			return "No lock-screen alert: this browser can't receive notifications. On iPhone, open the app from the Home Screen.";
		case PUSH_BLOCKER.denied:
			return "No lock-screen alert: notifications are turned off for this app.";
		case PUSH_BLOCKER.notEnabled:
			return "No lock-screen alert: notifications aren't enabled yet.";
	}
}
