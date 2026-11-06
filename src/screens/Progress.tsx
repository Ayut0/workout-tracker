import { useMemo, useState } from "react";
import { LineChart } from "../components/LineChart";
import type { WeightUnit } from "../db/types";
import {
	useExerciseProgress,
	useExercisesWithHistory,
} from "../hooks/useExerciseProgress";
import { useSettings } from "../hooks/useSettings";
import { CHART_RANGES, type ChartRangeId, selectChartData } from "../lib/chart";
import type { PersonalRecord, PersonalRecords } from "../lib/metrics";
import {
	buildMetricSeries,
	formatMetricValue,
	formatVolume,
	type ProgressMetric,
} from "../lib/progress";
import { formatWeight } from "../lib/units";

const CHARTS: { metric: ProgressMetric; title: string }[] = [
	{ metric: "e1rm", title: "Estimated 1RM" },
	{ metric: "volume", title: "Volume" },
];

const RANGE_NAMES: Record<ChartRangeId, string> = {
	"3m": "the last 3 months",
	"1y": "the last year",
	all: "any finished workout",
};

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
	month: "short",
	year: "numeric",
});

export function Progress() {
	const exercises = useExercisesWithHistory();
	const [chosenId, setChosenId] = useState<string | undefined>(undefined);
	const exercise = exercises?.find((e) => e.id === chosenId) ?? exercises?.[0];
	const { settings, loaded } = useSettings();
	const exerciseProgress = useExerciseProgress(exercise?.id);
	// Wait for the weight unit too, so values never flash in kg before lb.
	const progress = loaded ? exerciseProgress : undefined;
	const unit = settings.weightUnit;
	const [range, setRange] = useState<ChartRangeId>("1y");
	// Ranges end when the screen opened; that is "now" enough for a chart.
	const [now] = useState(() => Date.now());

	const charts = useMemo(
		() =>
			CHARTS.map(({ metric, title }) => ({
				metric,
				title,
				...selectChartData(
					buildMetricSeries(progress?.points ?? [], metric, unit),
					range,
					now,
				),
			})),
		[progress, unit, range, now],
	);

	return (
		<>
			<header className="head">
				<h1>Progress</h1>
			</header>

			{exercises?.length === 0 && (
				<p className="empty">
					Finish a workout and your progress per exercise will show here.
				</p>
			)}

			{exercise && (
				<label className="field">
					<span className="label">Exercise</span>
					<select
						value={exercise.id}
						onChange={(e) => setChosenId(e.target.value)}
					>
						{exercises?.map((e) => (
							<option key={e.id} value={e.id}>
								{e.name}
							</option>
						))}
					</select>
				</label>
			)}

			{progress?.points.length === 0 && (
				<p className="empty">No finished workouts with this exercise yet.</p>
			)}

			{progress && progress.points.length > 0 && (
				<>
					<Records records={progress.records} unit={unit} />

					<fieldset className="segmented">
						<legend className="visually-hidden">Date range</legend>
						{CHART_RANGES.map((r) => (
							<button
								key={r.id}
								type="button"
								className={r.id === range ? "chip on" : "chip"}
								aria-pressed={r.id === range}
								onClick={() => setRange(r.id)}
							>
								{r.label}
							</button>
						))}
					</fieldset>

					{charts.map(({ metric, title, data, sampled }) => (
						<section key={metric} aria-labelledby={`chart-${metric}`}>
							<h2 id={`chart-${metric}`}>{title}</h2>
							{data.length === 0 ? (
								<p className="empty">
									No {title} from {RANGE_NAMES[range]}.
								</p>
							) : (
								<LineChart
									// A new exercise, range or unit starts back at the latest point.
									key={`${exercise?.id}-${range}-${unit}`}
									title={title}
									data={data}
									formatValue={(value) =>
										formatMetricValue(value, metric, unit)
									}
								/>
							)}
							{sampled && (
								<p className="lead">
									Each point is the best of several workouts.
								</p>
							)}
						</section>
					))}
				</>
			)}
		</>
	);
}

type RecordsProps = { records: PersonalRecords; unit: WeightUnit };

/** Personal records: best Estimated 1RM, heaviest weight and best Volume. */
function Records({ records, unit }: RecordsProps) {
	const tiles: {
		label: string;
		record: PersonalRecord | undefined;
		format: (kg: number, unit: WeightUnit) => string;
	}[] = [
		{ label: "Best est. 1RM", record: records.bestE1rm, format: formatWeight },
		{ label: "Heaviest", record: records.heaviestWeight, format: formatWeight },
		{ label: "Best volume", record: records.bestVolume, format: formatVolume },
	];
	return (
		<section aria-labelledby="records">
			<h2 id="records">Personal records</h2>
			<dl className="records">
				{tiles.map(({ label, record, format }) => (
					<div key={label} className="record">
						<dt>{label}</dt>
						<dd>{record ? format(record.kg, unit) : "—"}</dd>
						{record && (
							<dd className="hint">{DATE_FORMAT.format(record.date)}</dd>
						)}
					</div>
				))}
			</dl>
		</section>
	);
}
