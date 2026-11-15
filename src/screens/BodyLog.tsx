import { type FormEvent, useMemo, useState } from "react";
import { LineChart } from "../components/LineChart";
import { Link } from "../components/Link";
import { parseLocalDay } from "../db/bodyLog";
import type { BodyEntry, WeightUnit } from "../db/types";
import { bodyLogActions, useBodyEntries } from "../hooks/useBodyLog";
import { useSettings } from "../hooks/useSettings";
import {
	type BodyEntryForm,
	type BodyMeasure,
	buildBodySeries,
	formatBodyValue,
	formatLocalDay,
	parseBodyEntryForm,
	toBodyEntryForm,
	WAIST_UNIT,
} from "../lib/bodyLog";
import { CHART_RANGES, type ChartRangeId, selectChartData } from "../lib/chart";
import { PROGRESS_PATH } from "../lib/routes";

const CHARTS: { measure: BodyMeasure; title: string }[] = [
	{ measure: "bodyWeight", title: "Body weight" },
	{ measure: "waist", title: "Waist" },
];

const RANGE_NAMES: Record<ChartRangeId, string> = {
	"3m": "the last 3 months",
	"1y": "the last year",
	all: "any day",
};

const ENTRY_NOUN = { one: "entry", other: "entries" };

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
	weekday: "short",
	day: "numeric",
	month: "short",
	year: "numeric",
});

/** A stored "YYYY-MM-DD" day for display, e.g. "Fri, 2 Jan 2026". */
function formatDay(day: string): string {
	const midnight = parseLocalDay(day);
	return midnight === undefined ? day : DAY_FORMAT.format(midnight);
}

/** The body log (Progress › Body log): log a day, chart it, list the days. */
export function BodyLog() {
	const entries = useBodyEntries();
	const { settings, loaded } = useSettings();
	// "Today" and chart ranges are fixed when the screen opens; enough for a log.
	const [now] = useState(() => Date.now());
	const unit = settings.weightUnit;

	return (
		<>
			<Link to={PROGRESS_PATH} className="back">
				‹ Progress
			</Link>
			<header className="head">
				<h1>Body log</h1>
				<p className="lead">
					Body weight and waist, one entry per day. Stays on this phone.
				</p>
			</header>

			{entries !== undefined && loaded && (
				<>
					<EntryForm
						// A new unit starts the form over, so typed text is never misread.
						key={unit}
						entries={entries}
						unit={unit}
						today={formatLocalDay(now)}
					/>
					{entries.length === 0 ? (
						<p className="empty">
							Log a day and your body weight and waist will chart here.
						</p>
					) : (
						<>
							<BodyCharts entries={entries} unit={unit} now={now} />
							<EntryList entries={entries} unit={unit} />
						</>
					)}
				</>
			)}
		</>
	);
}

type EntryFormProps = {
	entries: readonly BodyEntry[];
	unit: WeightUnit;
	/** Today's local day, "YYYY-MM-DD". */
	today: string;
};

/**
 * Logs one day. Choosing a day that has an entry fills in its measurements,
 * and saving replaces them; a field left blank is not recorded.
 */
function EntryForm({ entries, unit, today }: EntryFormProps) {
	const findEntry = (day: string) => entries.find((e) => e.date === day);
	const [form, setForm] = useState<BodyEntryForm>(() =>
		toBodyEntryForm(findEntry(today), today, unit),
	);
	// `field` is the input at fault; none for a failed write.
	const [error, setError] = useState<{
		field?: keyof BodyEntryForm;
		message: string;
	} | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const existing = findEntry(form.date);

	function change(field: keyof BodyEntryForm, value: string) {
		setNotice(null);
		setError(null);
		setForm((current) =>
			field === "date"
				? toBodyEntryForm(findEntry(value), value, unit)
				: { ...current, [field]: value },
		);
	}

	async function submit(e: FormEvent) {
		e.preventDefault();
		const parsed = parseBodyEntryForm(form, unit, existing);
		if (!parsed.ok) {
			setError({ field: parsed.field, message: parsed.message });
			return;
		}
		setSaving(true);
		try {
			await bodyLogActions.save(parsed.input);
			setNotice(`Saved ${formatDay(parsed.input.date)}.`);
		} catch {
			setError({ message: "Could not save. Try again." });
		} finally {
			setSaving(false);
		}
	}

	const invalid = (field: keyof BodyEntryForm) => error?.field === field;

	return (
		<section aria-labelledby="body-entry">
			<h2 id="body-entry">{existing ? "Change a day" : "Log a day"}</h2>
			<form className="stack" onSubmit={submit} noValidate>
				<label className="field">
					<span className="label">Day</span>
					<input
						type="date"
						value={form.date}
						max={today}
						required
						aria-invalid={invalid("date")}
						aria-describedby="body-entry-message"
						onChange={(e) => change("date", e.target.value)}
					/>
				</label>
				<label className="field">
					<span className="label">Body weight ({unit})</span>
					<input
						type="text"
						inputMode="decimal"
						autoComplete="off"
						value={form.bodyWeight}
						aria-invalid={invalid("bodyWeight")}
						aria-describedby="body-entry-message"
						onChange={(e) => change("bodyWeight", e.target.value)}
					/>
				</label>
				<label className="field">
					<span className="label">Waist ({WAIST_UNIT})</span>
					<input
						type="text"
						inputMode="decimal"
						autoComplete="off"
						value={form.waist}
						aria-invalid={invalid("waist")}
						aria-describedby="body-entry-message"
						onChange={(e) => change("waist", e.target.value)}
					/>
				</label>
				<p
					id="body-entry-message"
					className={error ? "error" : notice ? "notice" : "lead"}
					role={error ? "alert" : "status"}
				>
					{error?.message ??
						notice ??
						(existing
							? "This day has an entry; saving replaces it. Leave a field blank to clear it."
							: "Fill in either or both.")}
				</p>
				<button type="submit" className="primary" disabled={saving}>
					Save
				</button>
			</form>
		</section>
	);
}

type BodyChartsProps = {
	entries: readonly BodyEntry[];
	unit: WeightUnit;
	now: number;
};

/** Body weight and waist over a chosen range. */
function BodyCharts({ entries, unit, now }: BodyChartsProps) {
	const [range, setRange] = useState<ChartRangeId>("3m");
	const charts = useMemo(
		() =>
			CHARTS.map(({ measure, title }) => ({
				measure,
				title,
				...selectChartData(buildBodySeries(entries, measure, unit), range, now),
			})),
		[entries, unit, range, now],
	);

	return (
		<>
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

			{charts.map(({ measure, title, data, sampled }) => (
				<section key={measure} aria-labelledby={`chart-${measure}`}>
					<h2 id={`chart-${measure}`}>{title}</h2>
					{data.length === 0 ? (
						<p className="empty">
							No {title.toLowerCase()} from {RANGE_NAMES[range]}.
						</p>
					) : (
						<LineChart
							// A new range or unit starts back at the latest point.
							key={`${range}-${unit}`}
							title={title}
							data={data}
							pointNoun={ENTRY_NOUN}
							formatValue={(value) => formatBodyValue(value, measure, unit)}
						/>
					)}
					{sampled && (
						<p className="lead">Each point is the highest of several days.</p>
					)}
				</section>
			))}
		</>
	);
}

type EntryListProps = { entries: readonly BodyEntry[]; unit: WeightUnit };

/** Every logged day, newest first, each with a delete button. */
function EntryList({ entries, unit }: EntryListProps) {
	const newestFirst = useMemo(() => [...entries].reverse(), [entries]);

	async function remove(entry: BodyEntry) {
		if (!window.confirm(`Delete the entry for ${formatDay(entry.date)}?`)) {
			return;
		}
		await bodyLogActions.remove(entry.id);
	}

	return (
		<section aria-labelledby="body-days" className="log">
			<h2 id="body-days">Days</h2>
			<ul>
				{newestFirst.map((entry) => {
					const values = toBodyEntryForm(entry, entry.date, unit);
					return (
						<li key={entry.id} className="row body-row">
							<span>{formatDay(entry.date)}</span>
							<span className="body-values">
								{values.bodyWeight !== "" && (
									<span>
										{values.bodyWeight} {unit}
									</span>
								)}
								{values.waist !== "" && (
									<span>
										{values.waist} {WAIST_UNIT}
									</span>
								)}
							</span>
							<button
								type="button"
								className="icon-button danger-text body-delete"
								aria-label={`Delete ${formatDay(entry.date)}`}
								onClick={() => remove(entry)}
							>
								Delete
							</button>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
