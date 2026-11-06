import { useLiveQuery } from "dexie-react-hooks";
import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { readRestWatch } from "../db/restWatch";
import type { CompletedSet } from "../db/workoutLog";
import { resolveRestSeconds } from "../lib/restDuration";
import { restActionsForLog } from "../lib/restSession";
import {
	connectTimerApi,
	createRestSession,
	type RestSnapshot,
} from "../lib/restSessionFlow";
import { useSettings } from "./useSettings";

export interface RestSessionValue {
	snapshot: RestSnapshot;
	/** Starts the rest for a set just marked done, replacing any running one. */
	start: (completed: CompletedSet) => void;
	adjust: (deltaSeconds: number) => void;
	skip: () => void;
}

export const RestSessionContext = createContext<RestSessionValue | null>(null);

/** The app's rest timer; needs a RestSessionProvider above. */
export function useRestSession(): RestSessionValue {
	const value = useContext(RestSessionContext);
	if (!value) throw new Error("useRestSession needs a RestSessionProvider");
	return value;
}

/**
 * Owns the rest timer for the whole app, so it survives tab switches. Watches
 * the workout log: finishing or discarding the workout ends the rest, and so
 * does uncompleting (or removing) the set that started it.
 */
export function useRestSessionOwner(): RestSessionValue {
	const [session] = useState(() =>
		createRestSession({ connect: connectTimerApi }),
	);
	const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
	const { settings } = useSettings();

	const setId = snapshot.rest?.setId;
	const watch = useLiveQuery(() => readRestWatch(setId), [setId]);
	const previousWorkoutId = useRef<string | null>(null);
	useEffect(() => {
		if (!watch) return;
		const actions = restActionsForLog(
			previousWorkoutId.current,
			watch,
			session.getSnapshot().rest,
		);
		previousWorkoutId.current = watch.activeWorkoutId;
		for (const action of actions) void session.dispatch(action);
	}, [watch, session]);

	return useMemo(
		() => ({
			snapshot,
			start: (completed: CompletedSet) =>
				void session.dispatch({
					type: "start",
					setId: completed.set.id,
					seconds: resolveRestSeconds(completed.exercise, settings),
					now: Date.now(),
				}),
			adjust: (deltaSeconds: number) =>
				void session.dispatch({
					type: "adjust",
					deltaSeconds,
					now: Date.now(),
				}),
			skip: () => void session.dispatch({ type: "skip" }),
		}),
		[snapshot, session, settings],
	);
}
