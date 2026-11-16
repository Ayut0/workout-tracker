import { useState } from "react";
import { Link } from "../components/Link";
import { useNow } from "../hooks/useNow";
import { useWeeklySets } from "../hooks/useWeeklySets";
import { MUSCLE_GROUP_LABELS } from "../lib/exerciseAttributes";
import { PROGRESS_PATH } from "../lib/routes";
import {
	addWeeks,
	formatSetCount,
	shiftWeek,
	startOfWeek,
} from "../lib/weeklySets";

/** How often the current week is re-read from the clock. */
const NOW_TICK_MS = 60_000;

const WEEK_FORMAT = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
	month: "short",
	year: "numeric",
});

/** A week's dates, Monday to Sunday, e.g. "9 – 15 Nov 2026". */
function formatWeek(weekStart: number): string {
	// The last moment of Sunday, so the range ends on Sunday's date.
	return WEEK_FORMAT.formatRange(weekStart, addWeeks(weekStart, 1) - 1);
}

/** Weekly sets (Progress › Weekly sets): hard sets per muscle group by week. */
export function WeeklySets() {
	// "This week" follows the clock, so a screen left open across Monday 00:00
	// (or a PWA resumed the next week) moves on. Browsing back pins a week;
	// undefined means following the current one.
	const now = useNow(NOW_TICK_MS);
	const thisWeek = startOfWeek(now);
	const [pinnedWeek, setPinnedWeek] = useState<number>();
	const weekStart = pinnedWeek ?? thisWeek;
	const counts = useWeeklySets(weekStart);
	const isThisWeek = weekStart === thisWeek;

	return (
		<>
			<Link to={PROGRESS_PATH} className="back">
				‹ Progress
			</Link>
			<header className="head">
				<h1>Weekly sets</h1>
				<p className="lead">
					Complete sets per muscle group, warm-ups left out. A set counts 1 for
					each primary muscle of its exercise and 0.5 for each secondary one.
				</p>
			</header>

			<nav className="week-nav" aria-label="Week">
				<button
					type="button"
					className="chip"
					aria-label="Previous week"
					onClick={() => setPinnedWeek(shiftWeek(pinnedWeek, thisWeek, -1))}
				>
					‹
				</button>
				<p className="week-label" aria-live="polite">
					<span>{isThisWeek ? "This week" : "Week of"}</span>
					<span className="hint">{formatWeek(weekStart)}</span>
				</p>
				<button
					type="button"
					className="chip"
					aria-label="Next week"
					disabled={isThisWeek}
					onClick={() => setPinnedWeek(shiftWeek(pinnedWeek, thisWeek, 1))}
				>
					›
				</button>
			</nav>

			{counts?.length === 0 && (
				<p className="empty">
					No sets in this week for exercises with muscles. Set an exercise's
					muscles in the Exercises tab.
				</p>
			)}

			{counts !== undefined && counts.length > 0 && (
				<section aria-labelledby="weekly-muscles" className="log">
					<h2 id="weekly-muscles" className="visually-hidden">
						Sets per muscle group
					</h2>
					<ul>
						{counts.map(({ muscle, sets }) => (
							<li key={muscle} className="row">
								<span>{MUSCLE_GROUP_LABELS[muscle]}</span>
								<span>{formatSetCount(sets)}</span>
							</li>
						))}
					</ul>
				</section>
			)}
		</>
	);
}
