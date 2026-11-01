import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useState } from "react";
import { db } from "./db";
import type { RestTimer } from "./db/types";
import {
	cancelRestPush,
	currentSubscription,
	enableNotifications,
	isConfigured,
	isStandalone,
	type PermissionState,
	permissionState,
	scheduleRestPush,
} from "./lib/push";
import { formatCountdown, outcomeLabel, timerOutcome } from "./lib/restTimer";

const PRESETS = [60, 90, 120];

function useNow(intervalMs: number): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), intervalMs);
		return () => window.clearInterval(id);
	}, [intervalMs]);
	return now;
}

function formatClock(ms: number): string {
	return new Date(ms).toLocaleTimeString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

export function App() {
	const now = useNow(250);
	const [standalone] = useState(isStandalone);
	const [permission, setPermission] =
		useState<PermissionState>(permissionState);
	const [subscription, setSubscription] = useState<PushSubscription | null>(
		null,
	);
	const [persisted, setPersisted] = useState<boolean | null>(null);
	const [seconds, setSeconds] = useState(90);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const history = useLiveQuery(
		() => db.restTimers.orderBy("scheduledAt").reverse().limit(20).toArray(),
		[],
		[] as RestTimer[],
	);
	const active = history.find(
		(t) => t.status === "pending" && t.scheduledAt > now - 1000,
	);

	useEffect(() => {
		currentSubscription()
			.then(setSubscription)
			.catch(() => setSubscription(null));
		navigator.storage
			?.persisted?.()
			.then(setPersisted)
			.catch(() => setPersisted(null));
	}, []);

	const onEnable = useCallback(async () => {
		setError(null);
		setBusy(true);
		try {
			const sub = await enableNotifications();
			setSubscription(sub);
			// Ask the browser to keep our data; Home Screen apps are favoured.
			setPersisted((await navigator.storage?.persist?.()) ?? null);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setPermission(permissionState());
			setBusy(false);
		}
	}, []);

	const onStart = useCallback(async () => {
		if (!subscription) return;
		setError(null);
		setBusy(true);
		const fireAt = Date.now() + seconds * 1000;
		const id = crypto.randomUUID();
		try {
			// The worker keeps one timer per device, so older pending ones are replaced.
			await db.restTimers
				.where("status")
				.equals("pending")
				.modify({ status: "cancelled" });
			await db.restTimers.add({
				id,
				scheduledAt: fireAt,
				createdAt: Date.now(),
				status: "pending",
			});
			await scheduleRestPush(subscription, fireAt);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			await db.restTimers.update(id, { status: "failed", error: message });
			setError(message);
		} finally {
			setBusy(false);
		}
	}, [subscription, seconds]);

	const onCancel = useCallback(async () => {
		if (!subscription || !active) return;
		setError(null);
		try {
			await cancelRestPush(subscription);
			await db.restTimers.update(active.id, { status: "cancelled" });
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, [subscription, active]);

	const ready = isConfigured() && subscription !== null;

	return (
		<main className="app">
			<header className="head">
				<p className="eyebrow">Phase 1 · Notification check</p>
				<h1>Rest timer</h1>
				<p className="lead">
					Start a timer, lock your phone, and wait for the notification. The log
					below shows how late each one arrived.
				</p>
			</header>

			<section className="checks" aria-label="Setup">
				<Check
					ok={standalone}
					label="Opened from the Home Screen"
					hint="In Safari: Share → Add to Home Screen"
				/>
				<Check
					ok={permission === "granted"}
					label="Notifications allowed"
					hint={
						permission === "denied"
							? "Turn them on in the Settings app"
							: "Use the button below"
					}
				/>
				<Check
					ok={subscription !== null}
					label="Subscribed for push"
					hint="Happens when you allow notifications"
				/>
				<Check
					ok={persisted === true}
					label="Storage kept on device"
					hint="Requested after you allow notifications"
				/>
				{!isConfigured() && (
					<p className="warn">
						VITE_VAPID_PUBLIC_KEY and VITE_PUSH_API_URL are not set. Follow the
						README to set them.
					</p>
				)}
			</section>

			{subscription === null ? (
				<button
					type="button"
					className="primary"
					onClick={onEnable}
					disabled={busy || !isConfigured() || permission === "unsupported"}
				>
					Allow notifications
				</button>
			) : (
				<section className="timer" aria-label="Timer">
					<output className="countdown" aria-live="polite">
						{active
							? formatCountdown(active.scheduledAt - now)
							: formatCountdown(seconds * 1000)}
					</output>
					{active ? (
						<button type="button" className="secondary" onClick={onCancel}>
							Cancel
						</button>
					) : (
						<>
							<div className="presets">
								{PRESETS.map((s) => (
									<button
										key={s}
										type="button"
										className={s === seconds ? "chip on" : "chip"}
										onClick={() => setSeconds(s)}
										aria-pressed={s === seconds}
									>
										{s}s
									</button>
								))}
							</div>
							<button
								type="button"
								className="primary"
								onClick={onStart}
								disabled={busy || !ready}
							>
								Start
							</button>
						</>
					)}
				</section>
			)}

			{error && (
				<p className="error" role="alert">
					{error}
				</p>
			)}

			<section className="log" aria-label="Log">
				<h2>Log</h2>
				{history.length === 0 ? (
					<p className="empty">
						No timers yet. Each timer you start appears here with when it was
						due and when it arrived.
					</p>
				) : (
					<ul>
						{history.map((t) => {
							const outcome = timerOutcome(t, now);
							return (
								<li key={t.id} className={`row ${outcome.kind}`}>
									<span className="time">{formatClock(t.scheduledAt)}</span>
									<span className="result">{outcomeLabel(outcome)}</span>
								</li>
							);
						})}
					</ul>
				)}
			</section>
		</main>
	);
}

function Check({
	ok,
	label,
	hint,
}: {
	ok: boolean;
	label: string;
	hint: string;
}) {
	return (
		<div className={ok ? "check ok" : "check"}>
			<span className="mark" aria-hidden="true">
				{ok ? "✓" : "–"}
			</span>
			<span className="label">{label}</span>
			{!ok && <span className="hint">{hint}</span>}
		</div>
	);
}
