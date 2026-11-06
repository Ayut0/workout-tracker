import { useNow } from "../hooks/useNow";
import { useRestSession } from "../hooks/useRestSession";
import {
	describePushBlocker,
	type PushBlocker,
	REST_ADJUST_SECONDS,
	type Rest,
	remainingRestMs,
	restProgress,
} from "../lib/restSession";
import { formatCountdown } from "../lib/restTimer";
import { NOTIFICATION_CHECK_PATH } from "../lib/routes";
import { Link } from "./Link";

const TICK_MS = 250;

/** The rest countdown on the Workout screen, while resting. */
export function RestTimerBar() {
	const { snapshot, adjust, skip } = useRestSession();
	if (!snapshot.rest) return null;
	return (
		<RestCountdown
			rest={snapshot.rest}
			pushBlocker={snapshot.pushBlocker}
			pushError={snapshot.pushError}
			onAdjust={adjust}
			onSkip={skip}
		/>
	);
}

type RestCountdownProps = {
	rest: Rest;
	pushBlocker: PushBlocker | null;
	pushError: string | null;
	onAdjust: (deltaSeconds: number) => void;
	onSkip: () => void;
};

function RestCountdown({
	rest,
	pushBlocker,
	pushError,
	onAdjust,
	onSkip,
}: RestCountdownProps) {
	const now = useNow(TICK_MS);
	return (
		<section className="rest-bar" aria-label="Rest timer">
			<div className="rest-track" aria-hidden="true">
				<div
					className="rest-fill"
					style={{ transform: `scaleX(${restProgress(rest, now)})` }}
				/>
			</div>
			<div className="rest-row">
				<span className="rest-label">Rest</span>
				<span className="rest-time" role="timer">
					{formatCountdown(remainingRestMs(rest, now))}
				</span>
				<button
					type="button"
					className="chip"
					onClick={() => onAdjust(-REST_ADJUST_SECONDS)}
				>
					−{REST_ADJUST_SECONDS} s
				</button>
				<button
					type="button"
					className="chip"
					onClick={() => onAdjust(REST_ADJUST_SECONDS)}
				>
					+{REST_ADJUST_SECONDS} s
				</button>
				<button type="button" className="chip rest-skip" onClick={onSkip}>
					Skip
				</button>
			</div>
			{pushBlocker !== null && (
				<p className="rest-note">
					{describePushBlocker(pushBlocker)} See{" "}
					<Link to={NOTIFICATION_CHECK_PATH}>
						Settings → Notification check
					</Link>
					.
				</p>
			)}
			{pushError !== null && (
				<p className="error" role="alert">
					Lock-screen alert not scheduled: {pushError}
				</p>
			)}
		</section>
	);
}
