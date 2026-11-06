/**
 * Pure geometry for the Progress line charts: date ranges, downsampling and
 * scales. Kept out of the component so it can be tested and stays cheap with
 * years of workouts.
 */
import type { ChartDatum } from "./progress";

export const CHART_RANGES = [
	{ id: "3m", label: "3M", months: 3 },
	{ id: "1y", label: "1Y", months: 12 },
	{ id: "all", label: "All", months: undefined },
] as const;

export type ChartRangeId = (typeof CHART_RANGES)[number]["id"];

/** The earliest time a range shows, or undefined for All. */
export function findRangeStart(
	range: ChartRangeId,
	now: number,
): number | undefined {
	const months = CHART_RANGES.find((r) => r.id === range)?.months;
	if (months === undefined) return undefined;
	const start = new Date(now);
	start.setMonth(start.getMonth() - months);
	return start.getTime();
}

/** The points within a range ending now. */
export function filterByRange(
	data: readonly ChartDatum[],
	range: ChartRangeId,
	now: number,
): readonly ChartDatum[] {
	const start = findRangeStart(range, now);
	if (start === undefined) return data;
	return data.filter((d) => d.date >= start);
}

/**
 * At most `maxPoints` points, in order. The first and last points are kept;
 * the rest are split into equal runs and each run keeps its highest value, so
 * peaks (records) survive. Short series are returned as they are.
 */
export function downsampleSeries(
	data: readonly ChartDatum[],
	maxPoints: number,
): readonly ChartDatum[] {
	if (data.length <= maxPoints) return data;
	const first = data[0];
	const last = data.at(-1);
	if (!first || !last) return data;
	const middle = data.slice(1, -1);
	const buckets = maxPoints - 2;
	const sampled: ChartDatum[] = [first];
	for (let b = 0; b < buckets; b++) {
		const from = Math.floor((b * middle.length) / buckets);
		const to = Math.floor(((b + 1) * middle.length) / buckets);
		let best: ChartDatum | undefined;
		for (let i = from; i < to; i++) {
			const datum = middle[i];
			if (datum && (best === undefined || datum.value > best.value)) {
				best = datum;
			}
		}
		if (best) sampled.push(best);
	}
	sampled.push(last);
	return sampled;
}

/**
 * Points a chart draws at most: about one per 3 px of a phone-width chart.
 * Years of workouts stay this cheap to draw and to inspect.
 */
export const MAX_CHART_POINTS = 120;

/** A metric's chart for a range: in range, then downsampled to fit. */
export function selectChartData(
	series: readonly ChartDatum[],
	range: ChartRangeId,
	now: number,
): { data: readonly ChartDatum[]; sampled: boolean } {
	const inRange = filterByRange(series, range, now);
	const data = downsampleSeries(inRange, MAX_CHART_POINTS);
	return { data, sampled: data.length < inRange.length };
}

/** Steps a tick may take, per power of ten. */
const NICE_STEPS = [1, 2, 2.5, 5, 10];

function findNiceStep(rough: number): number {
	const power = 10 ** Math.floor(Math.log10(rough));
	const fraction = rough / power;
	const step = NICE_STEPS.find((s) => s >= fraction) ?? 10;
	return step * power;
}

/** Drops float noise such as 0.30000000000000004. */
function trimFloat(value: number): number {
	return Number(value.toPrecision(12));
}

/**
 * Round tick values from at or below `min` to at or above `max`, about
 * `count` steps apart. A flat series (min = max) is widened around its value.
 */
export function listNiceTicks(
	min: number,
	max: number,
	count: number,
): number[] {
	let low = min;
	let high = max;
	if (high === low) {
		const pad = Math.max(Math.abs(low) * 0.05, 1);
		low -= pad;
		high += pad;
	}
	const step = findNiceStep((high - low) / count);
	const start = Math.floor(low / step) * step;
	const end = Math.ceil(high / step) * step;
	const ticks: number[] = [];
	for (let i = 0; start + i * step <= end + step / 2; i++) {
		ticks.push(trimFloat(start + i * step));
	}
	return ticks;
}

/** The chart's size in SVG units and the margins around the plot area. */
export interface ChartFrame {
	width: number;
	height: number;
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export interface ChartDot {
	x: number;
	y: number;
	datum: ChartDatum;
}

export interface LineChartLayout {
	/** SVG path data through every dot; empty for no data. */
	path: string;
	dots: ChartDot[];
	yTicks: { y: number; value: number }[];
}

/** About how many gridlines a chart gets. */
const Y_TICK_COUNT = 4;

/** Coordinates in tenths of an SVG unit keep the path short. */
function roundCoordinate(value: number): number {
	return Math.round(value * 10) / 10;
}

/**
 * Lays out a line chart: time runs left to right over the data's own span,
 * and the value axis spans round ticks around the data (not from zero, so
 * progress is visible).
 */
export function layoutLineChart(
	data: readonly ChartDatum[],
	frame: ChartFrame,
): LineChartLayout {
	const first = data[0];
	const last = data.at(-1);
	if (!first || !last) return { path: "", dots: [], yTicks: [] };

	const values = data.map((d) => d.value);
	const ticks = listNiceTicks(
		Math.min(...values),
		Math.max(...values),
		Y_TICK_COUNT,
	);
	const low = ticks[0] ?? 0;
	const high = ticks.at(-1) ?? 1;
	const plotLeft = frame.left;
	const plotWidth = frame.width - frame.left - frame.right;
	const plotBottom = frame.height - frame.bottom;
	const plotHeight = plotBottom - frame.top;
	const span = last.date - first.date;

	const scaleX = (date: number) =>
		roundCoordinate(
			span === 0
				? plotLeft + plotWidth / 2
				: plotLeft + ((date - first.date) / span) * plotWidth,
		);
	const scaleY = (value: number) =>
		roundCoordinate(plotBottom - ((value - low) / (high - low)) * plotHeight);

	const dots = data.map((datum) => ({
		x: scaleX(datum.date),
		y: scaleY(datum.value),
		datum,
	}));
	const path = dots
		.map((dot, i) => `${i === 0 ? "M" : "L"}${dot.x},${dot.y}`)
		.join("");
	return {
		path,
		dots,
		yTicks: ticks.map((value) => ({ y: scaleY(value), value })),
	};
}

/** The index of the x closest to `x` in ascending `xs`; undefined if empty. */
export function findNearestIndex(
	xs: readonly number[],
	x: number,
): number | undefined {
	if (xs.length === 0) return undefined;
	let low = 0;
	let high = xs.length - 1;
	while (low < high) {
		const mid = Math.floor((low + high) / 2);
		if ((xs[mid] ?? 0) < x) low = mid + 1;
		else high = mid;
	}
	const previous = xs[low - 1];
	const current = xs[low] ?? 0;
	if (previous !== undefined && x - previous <= current - x) return low - 1;
	return low;
}
