import type { HistoryEntry } from "../../db/history";
import type { WeightUnit } from "../../db/types";
import { formatDuration, summarizeWorkout } from "../../lib/history";
import { formatVolume } from "../../lib/progress";
import { historyDetailPath } from "../../lib/routes";
import { Link } from "../Link";

/** Exercises listed in a row before the rest are counted as "and N more". */
const SHOWN_EXERCISES = 4;

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
	weekday: "short",
	day: "numeric",
	month: "short",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit",
});

type HistoryRowProps = {
	entry: HistoryEntry;
	weightUnit: WeightUnit;
};

/** One finished workout in History: date, name, duration, exercises, volume. Opens its detail. */
export function HistoryRow({ entry, weightUnit }: HistoryRowProps) {
	const { workout } = entry;
	const summary = summarizeWorkout(entry);
	const shown = summary.exercises.slice(0, SHOWN_EXERCISES);
	const more = summary.exercises.length - shown.length;
	return (
		<li>
			<Link to={historyDetailPath(workout.id)} className="history-row">
				<span className="history-row-head">
					<strong className="history-name">{workout.name}</strong>
					<time
						className="history-date"
						dateTime={new Date(workout.startedAt).toISOString()}
					>
						{DATE_FORMAT.format(workout.startedAt)}
					</time>
				</span>
				<span className="history-stats">
					{summary.durationMs !== undefined && (
						<span>
							<span className="visually-hidden">Duration </span>
							{formatDuration(summary.durationMs)}
						</span>
					)}
					<span>
						<span className="visually-hidden">Volume </span>
						{formatVolume(summary.volumeKg, weightUnit)}
					</span>
				</span>
				{shown.length === 0 ? (
					<span className="history-exercises">No exercises</span>
				) : (
					<span className="history-exercises">
						{shown.map((exercise) => (
							<span key={exercise.workoutExerciseId}>
								{exercise.setCount} × {exercise.name}
							</span>
						))}
						{more > 0 && <span>and {more} more</span>}
					</span>
				)}
			</Link>
		</li>
	);
}
