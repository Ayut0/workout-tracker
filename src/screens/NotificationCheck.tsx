import { Suspense, use } from "react";
import { Link } from "../components/Link";
import { useNotificationSetup } from "../hooks/useNotificationSetup";
import { useRestTimer } from "../hooks/useRestTimer";
import { isConfigured, PERMISSION } from "../lib/push";
import {
	formatCountdown,
	formatOutcome,
	getTimerOutcome,
} from "../lib/restTimer";

const PRESETS = [60, 90, 120];

function formatClock(ms: number): string {
	return new Date(ms).toLocaleTimeString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

type Setup = ReturnType<typeof useNotificationSetup>;

/** Settings → diagnostics: checks that rest-timer pushes arrive and how late. */
export function NotificationCheck() {
	const setup = useNotificationSetup();
	const { standalone, permission } = setup;

	return (
		<>
			<header className="head">
				<Link to="/settings" className="back">
					‹ Settings
				</Link>
				<p className="eyebrow">Diagnostics</p>
				<h1>Notification check</h1>
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
					ok={permission === PERMISSION.granted}
					label="Notifications allowed"
					hint={
						permission === PERMISSION.denied
							? "Turn them on in the Settings app"
							: "Use the button below"
					}
				/>
				<AsyncCheck
					value={setup.subscription}
					ok={(subscription) => subscription !== null}
					label="Subscribed for push"
					hint="Happens when you allow notifications"
				/>
				<AsyncCheck
					value={setup.persisted}
					ok={(persisted) => persisted === true}
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

			<Suspense fallback={null}>
				<Session setup={setup} />
			</Suspense>
		</>
	);
}

/** The enable button or the timer, and the log. Suspends until the subscription is read. */
function Session({ setup }: { setup: Setup }) {
	const { permission } = setup;
	const subscription = use(setup.subscription);
	const timer = useRestTimer(subscription);
	const { now, seconds, setSeconds, active, history } = timer;
	const error = setup.error ?? timer.error;
	const ready = isConfigured() && subscription !== null;

	return (
		<>
			{subscription === null ? (
				<button
					type="button"
					className="primary"
					onClick={setup.enable}
					disabled={
						setup.busy ||
						!isConfigured() ||
						permission === PERMISSION.unsupported
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
		</>
	);
}

type AsyncCheckProps<T> = {
	value: Promise<T>;
	ok: (value: T) => boolean;
	label: string;
	hint: string;
};

/** A check whose state is read from a promise; shows "Checking…" until it settles. */
function AsyncCheck<T>(props: AsyncCheckProps<T>) {
	return (
		<Suspense
			fallback={<Check ok={null} label={props.label} hint="Checking…" />}
		>
			<ResolvedCheck {...props} />
		</Suspense>
	);
}

function ResolvedCheck<T>({ value, ok, label, hint }: AsyncCheckProps<T>) {
	return <Check ok={ok(use(value))} label={label} hint={hint} />;
}

/** `ok` is null while the state is still being read. */
function Check({
	ok,
	label,
	hint,
}: {
	ok: boolean | null;
	label: string;
	hint: string;
}) {
	return (
		<div className={ok ? "check ok" : "check"}>
			<span className="mark" aria-hidden="true">
				{ok ? "✓" : ok === null ? "…" : "–"}
			</span>
			<span className="label">{label}</span>
			{!ok && <span className="hint">{hint}</span>}
		</div>
	);
}
