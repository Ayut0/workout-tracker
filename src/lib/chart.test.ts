import { describe, expect, it } from "vitest";
import {
	CHART_RANGES,
	type ChartFrame,
	computeLineChartLayout,
	downsampleSeries,
	filterByRange,
	findNearestIndex,
	findRangeStart,
	listNiceTicks,
	MAX_CHART_POINTS,
	selectChartData,
} from "./chart";
import type { ChartDatum } from "./progress";

const DAY = 86_400_000;

function makeDatum(date: number, value: number): ChartDatum {
	return { id: `w${date}`, date, value };
}

describe("findRangeStart", () => {
	const now = new Date(2026, 10, 6, 12).getTime();

	it("goes back calendar months for 3M and 1Y", () => {
		expect(findRangeStart("3m", now)).toBe(new Date(2026, 7, 6, 12).getTime());
		expect(findRangeStart("1y", now)).toBe(new Date(2025, 10, 6, 12).getTime());
	});

	it("has no start for All", () => {
		expect(findRangeStart("all", now)).toBeUndefined();
	});

	it("offers 3M, 1Y and All", () => {
		expect(CHART_RANGES.map((r) => r.label)).toEqual(["3M", "1Y", "All"]);
	});
});

describe("filterByRange", () => {
	const now = new Date(2026, 10, 6).getTime();
	const data = [
		makeDatum(new Date(2024, 0, 1).getTime(), 1),
		makeDatum(new Date(2026, 0, 1).getTime(), 2),
		makeDatum(new Date(2026, 9, 1).getTime(), 3),
	];

	it("keeps the points on or after the range start", () => {
		expect(filterByRange(data, "3m", now).map((d) => d.value)).toEqual([3]);
		expect(filterByRange(data, "1y", now).map((d) => d.value)).toEqual([2, 3]);
		expect(filterByRange(data, "all", now)).toEqual(data);
	});
});

describe("downsampleSeries", () => {
	it("returns short series unchanged", () => {
		const data = [makeDatum(1, 1), makeDatum(2, 2)];

		expect(downsampleSeries(data, 10)).toBe(data);
	});

	it("caps years of workouts at the point budget, keeping first, last and peaks", () => {
		const data = Array.from({ length: 5_000 }, (_, i) =>
			makeDatum(i * DAY, i === 2_500 ? 999 : i % 7),
		);

		const sampled = downsampleSeries(data, 120);

		expect(sampled.length).toBeLessThanOrEqual(120);
		expect(sampled[0]).toBe(data[0]);
		expect(sampled.at(-1)).toBe(data.at(-1));
		expect(sampled.some((d) => d.value === 999)).toBe(true);
		const dates = sampled.map((d) => d.date);
		expect(dates).toEqual([...dates].sort((a, b) => a - b));
	});

	it("can keep the last value of each run, which does not lean upward", () => {
		// A steady 70 kg with one-day blips up to 72 at the start of every run.
		const data = Array.from({ length: 1_000 }, (_, i) =>
			makeDatum(i * DAY, i % 8 === 0 ? 72 : 70),
		);

		const sampled = downsampleSeries(data, 120, "last");

		expect(sampled.length).toBeLessThanOrEqual(120);
		expect(sampled[0]).toBe(data[0]);
		expect(sampled.at(-1)).toBe(data.at(-1));
		const middle = sampled.slice(1, -1);
		const mean = middle.reduce((sum, d) => sum + d.value, 0) / middle.length;
		expect(mean).toBeLessThan(70.6);
		// The default still favours peaks.
		const peaks = downsampleSeries(data, 120).slice(1, -1);
		expect(peaks.every((d) => d.value === 72)).toBe(true);
		const dates = sampled.map((d) => d.date);
		expect(dates).toEqual([...dates].sort((a, b) => a - b));
	});
});

describe("selectChartData downsampling rule", () => {
	it("passes the downsampling rule through", () => {
		const now = 2_000 * DAY;
		const series = Array.from({ length: 1_000 }, (_, i) =>
			makeDatum(now - (1_000 - i) * DAY, i % 8 === 0 ? 72 : 70),
		);

		const peaks = selectChartData(series, "all", now);
		const last = selectChartData(series, "all", now, "last");

		expect(peaks.sampled).toBe(true);
		expect(last.sampled).toBe(true);
		expect(Math.max(...peaks.data.slice(1, -1).map((d) => d.value))).toBe(72);
		expect(Math.min(...peaks.data.slice(1, -1).map((d) => d.value))).toBe(72);
		expect(Math.min(...last.data.slice(1, -1).map((d) => d.value))).toBe(70);
	});
});

describe("listNiceTicks", () => {
	it("spans the values with round steps", () => {
		expect(listNiceTicks(83, 117, 4)).toEqual([80, 90, 100, 110, 120]);
	});

	it("widens a flat series so it has a range", () => {
		const ticks = listNiceTicks(100, 100, 4);

		expect(ticks[0]).toBeLessThan(100);
		expect(ticks.at(-1)).toBeGreaterThan(100);
	});
});

describe("computeLineChartLayout", () => {
	const frame: ChartFrame = {
		width: 300,
		height: 200,
		top: 10,
		right: 10,
		bottom: 20,
		left: 40,
	};

	it("maps the oldest point to the left edge and the newest to the right", () => {
		const layout = computeLineChartLayout(
			[makeDatum(0, 80), makeDatum(10 * DAY, 120)],
			frame,
		);

		expect(layout.dots[0]).toMatchObject({ x: 40, y: 180 });
		expect(layout.dots[1]).toMatchObject({ x: 290, y: 10 });
		expect(layout.path).toBe("M40,180L290,10");
	});

	it("puts y ticks inside the plot, bottom to top", () => {
		const layout = computeLineChartLayout(
			[makeDatum(0, 83), makeDatum(DAY, 117)],
			frame,
		);

		expect(layout.yTicks.map((t) => t.value)).toEqual([80, 90, 100, 110, 120]);
		expect(layout.yTicks[0]?.y).toBe(180);
		expect(layout.yTicks.at(-1)?.y).toBe(10);
	});

	it("centres a single point", () => {
		const layout = computeLineChartLayout([makeDatum(5, 100)], frame);

		expect(layout.dots[0]?.x).toBe(165);
	});

	it("draws nothing for no data", () => {
		const layout = computeLineChartLayout([], frame);

		expect(layout.path).toBe("");
		expect(layout.dots).toEqual([]);
	});
});

describe("findNearestIndex", () => {
	const xs = [10, 20, 40, 80];

	it("finds the dot closest to a position", () => {
		expect(findNearestIndex(xs, 0)).toBe(0);
		expect(findNearestIndex(xs, 29)).toBe(1);
		expect(findNearestIndex(xs, 31)).toBe(2);
		expect(findNearestIndex(xs, 500)).toBe(3);
	});

	it("is undefined when there are no dots", () => {
		expect(findNearestIndex([], 5)).toBeUndefined();
	});
});

describe("selectChartData", () => {
	const now = 10_000 * DAY;

	it("filters to the range, then downsamples to the point budget", () => {
		const series = Array.from({ length: 3_000 }, (_, i) =>
			makeDatum(now - i * DAY, 100),
		).reverse();

		const all = selectChartData(series, "all", now);
		const recent = selectChartData(series, "3m", now);

		expect(all.data.length).toBe(MAX_CHART_POINTS);
		expect(all.sampled).toBe(true);
		expect(recent.data.length).toBeLessThan(100);
		expect(recent.sampled).toBe(false);
	});
});
