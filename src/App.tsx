import { useNotificationSetup } from "./hooks/useNotificationSetup";
import { useRestTimer } from "./hooks/useRestTimer";
import { isConfigured } from "./lib/push";
import {
	formatCountdown,
	formatOutcome,
	getTimerOutcome,
} from "./lib/restTimer";

const PRESETS = [60, 90, 120];

function formatClock(ms: number): string {
	return new Date(ms).toLocaleTimeString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

export function App() {
	const setup = useNotificationSetup();
	const { standalone, permission, subscription, persisted } = setup;
	const timer = useRestTimer(subscription);
	const { now, seconds, setSeconds, active, history } = timer;
	const error = setup.error ?? timer.error;
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
					onClick={setup.enable}
					disabled={
						setup.busy || !isConfigured() || permission === "unsupported"
					}
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
						<button type="button" className="secondary" onClick={timer.cancel}>
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
								onClick={timer.start}
								disabled={timer.busy || !ready}
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
							const outcome = getTimerOutcome(t, now);
							return (
								<li key={t.id} className={`row ${outcome.kind}`}>
									<span className="time">{formatClock(t.scheduledAt)}</span>
									<span className="result">{formatOutcome(outcome)}</span>
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
