import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../db";
import type { RestTimer } from "../db/types";
import { cancelRestPush, scheduleRestPush } from "../lib/push";
import { findActiveTimer } from "../lib/restTimer";
import {
	cancelRestTimer,
	startRestTimer,
	type TimerApi,
} from "../lib/restTimerFlow";

const HISTORY_LIMIT = 20;
const NO_TIMERS: RestTimer[] = [];

function useNow(intervalMs: number): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), intervalMs);
		return () => window.clearInterval(id);
	}, [intervalMs]);
	return now;
}

/** The timer log and the start / cancel actions, for one push subscription. */
export function useRestTimer(subscription: PushSubscription | null) {
	const now = useNow(250);
	const [seconds, setSeconds] = useState(90);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const history = useLiveQuery(
		() =>
			db.restTimers
				.orderBy("scheduledAt")
				.reverse()
				.limit(HISTORY_LIMIT)
				.toArray(),
		[],
		NO_TIMERS,
	);
	const active = findActiveTimer(history, now);

	const api = useMemo<TimerApi | null>(
		() =>
			subscription && {
				schedule: (fireAt) => scheduleRestPush(subscription, fireAt),
				cancel: () => cancelRestPush(subscription),
			},
		[subscription],
	);

	const start = useCallback(async () => {
		if (!api) return;
		setError(null);
		setBusy(true);
		try {
			await startRestTimer(seconds, api);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}, [api, seconds]);

	const cancel = useCallback(async () => {
		if (!api || !active) return;
		setError(null);
		try {
			await cancelRestTimer(active, api);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, [api, active]);

	return {
		now,
		seconds,
		setSeconds,
		busy,
		error,
		history,
		active,
		start,
		cancel,
	};
}
