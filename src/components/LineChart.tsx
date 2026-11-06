import {
	type KeyboardEvent,
	type PointerEvent,
	useId,
	useMemo,
	useState,
} from "react";
import {
	type ChartFrame,
	findNearestIndex,
	layoutLineChart,
} from "../lib/chart";
import type { ChartDatum } from "../lib/progress";

/** SVG units; the chart scales to its container's width. */
const FRAME: ChartFrame = {
	width: 340,
	height: 190,
	top: 12,
	right: 14,
	bottom: 26,
	left: 50,
};

/** Above this many points, dots would crowd the line, so only it is drawn. */
const MAX_DOTS = 40;

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
	month: "short",
	year: "numeric",
});
const TICK_FORMAT = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 1,
});

type LineChartProps = {
	/** Names the chart for screen readers, e.g. "Estimated 1RM". */
	title: string;
	/** Oldest first, already in the user's unit. */
	data: readonly ChartDatum[];
	formatValue: (value: number) => string;
};

/**
 * A single-series line chart over time. Touch, drag or use the arrow keys to
 * read a workout's value; the latest is shown until then. Geometry comes from
 * src/lib/chart, so this only draws.
 */
export function LineChart({ title, data, formatValue }: LineChartProps) {
	const layout = useMemo(() => layoutLineChart(data, FRAME), [data]);
	const [selected, setSelected] = useState<number | undefined>(undefined);
	const summaryId = useId();
	const index = Math.min(selected ?? data.length - 1, data.length - 1);
	const active = layout.dots[index];
	const first = data[0];
	const last = data.at(-1);
	if (!active || !first || !last) return null;

	function inspect(e: PointerEvent<HTMLDivElement>) {
		const rect = e.currentTarget.getBoundingClientRect();
		if (rect.width === 0) return;
		const x = ((e.clientX - rect.left) / rect.width) * FRAME.width;
		const nearest = findNearestIndex(
			layout.dots.map((dot) => dot.x),
			x,
		);
		if (nearest !== undefined) setSelected(nearest);
	}

	function step(e: KeyboardEvent<HTMLDivElement>) {
		const targets: Record<string, number> = {
			ArrowLeft: index - 1,
			ArrowDown: index - 1,
			ArrowRight: index + 1,
			ArrowUp: index + 1,
			Home: 0,
			End: data.length - 1,
		};
		const target = targets[e.key];
		if (target === undefined) return;
		e.preventDefault();
		setSelected(Math.max(0, Math.min(data.length - 1, target)));
	}

	const plotBottom = FRAME.height - FRAME.bottom;
	const summary = `${data.length} ${data.length === 1 ? "workout" : "workouts"} from ${DAY_FORMAT.format(first.date)} to ${DAY_FORMAT.format(last.date)}, latest ${formatValue(last.value)}.`;
	const readout = `${formatValue(active.datum.value)}, ${DAY_FORMAT.format(active.datum.date)}`;

	return (
		<figure className="chart">
			<p className="chart-readout" aria-hidden="true">
				<strong>{formatValue(active.datum.value)}</strong>
				<span>{DAY_FORMAT.format(active.datum.date)}</span>
			</p>
			{/* A slider over the workouts: assistive tech reads the summary, then
			each workout's value as the arrow keys move along the line. */}
			<div
				className="chart-plot"
				role="slider"
				aria-label={title}
				aria-describedby={summaryId}
				aria-valuemin={0}
				aria-valuemax={data.length - 1}
				aria-valuenow={index}
				aria-valuetext={readout}
				aria-orientation="horizontal"
				tabIndex={0}
				onPointerDown={inspect}
				onPointerMove={inspect}
				onKeyDown={step}
			>
				<svg viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} aria-hidden="true">
					{layout.yTicks.map((tick) => (
						<g key={tick.value} className="chart-grid">
							<line
								x1={FRAME.left}
								x2={FRAME.width - FRAME.right}
								y1={tick.y}
								y2={tick.y}
							/>
							<text x={FRAME.left - 6} y={tick.y} dy="0.32em" textAnchor="end">
								{TICK_FORMAT.format(tick.value)}
							</text>
						</g>
					))}
					<line
						className="chart-crosshair"
						x1={active.x}
						x2={active.x}
						y1={FRAME.top}
						y2={plotBottom}
					/>
					<path className="chart-line" d={layout.path} />
					{layout.dots.length <= MAX_DOTS &&
						layout.dots.map((dot) => (
							<circle
								key={dot.datum.workoutId}
								className="chart-dot"
								cx={dot.x}
								cy={dot.y}
								r={4}
							/>
						))}
					<circle
						className="chart-dot active"
						cx={active.x}
						cy={active.y}
						r={6}
					/>
					<g className="chart-axis">
						<text x={FRAME.left} y={FRAME.height - 6} textAnchor="start">
							{DAY_FORMAT.format(first.date)}
						</text>
						{data.length > 1 && (
							<text
								x={FRAME.width - FRAME.right}
								y={FRAME.height - 6}
								textAnchor="end"
							>
								{DAY_FORMAT.format(last.date)}
							</text>
						)}
					</g>
				</svg>
			</div>
			<p id={summaryId} className="visually-hidden">
				{summary}
			</p>
			<details className="chart-table">
				<summary>Show as table</summary>
				<table>
					<caption className="visually-hidden">{title}</caption>
					<thead>
						<tr>
							<th scope="col">Date</th>
							<th scope="col">{title}</th>
						</tr>
					</thead>
					<tbody>
						{data.map((datum) => (
							<tr key={datum.workoutId}>
								<td>{DAY_FORMAT.format(datum.date)}</td>
								<td>{formatValue(datum.value)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</details>
		</figure>
	);
}
