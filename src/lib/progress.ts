/**
 * What the Progress tab shows for one exercise, prepared from its history:
 * progress points and personal records from the metrics helpers, and chart
 * series in the user's weight unit. Components only render these.
 */
import type { WeightUnit, Workout } from "../db/types";
import {
	type ExerciseHistoryInput,
	findPersonalRecords,
	listProgressPoints,
	type PersonalRecords,
	type ProgressPoint,
} from "./metrics";
import { convertFromKg, roundForDisplay } from "./units";

/** An entry of `listExerciseHistory`, with the workout's end time. */
export interface FinishedHistoryInput extends ExerciseHistoryInput {
	workout: Pick<Workout, "id" | "startedAt" | "endedAt">;
}

export interface ExerciseProgress {
	points: ProgressPoint[];
	records: PersonalRecords;
}

/**
 * Progress points and personal records over finished workouts only: the
 * workout in progress is still being logged, so its sets are not progress yet.
 */
export function summarizeProgress(
	history: readonly FinishedHistoryInput[],
): ExerciseProgress {
	const finished = history.filter(
		(entry) => entry.workout.endedAt !== undefined,
	);
	return {
		points: listProgressPoints(finished),
		records: findPersonalRecords(finished),
	};
}

/** A metric charted on the Progress tab. */
export type ProgressMetric = "e1rm" | "volume";

/** One point of a chart: a workout's value, in the user's weight unit. */
export interface ChartDatum {
	workoutId: string;
	/** The workout's start time (epoch ms). */
	date: number;
	value: number;
}

/**
 * A metric over time in the given unit, unrounded, oldest first. Workouts
 * without the metric (no Estimated 1RM, or 0 Volume from bodyweight sets) are
 * left out rather than drawn at 0.
 */
export function buildMetricSeries(
	points: readonly ProgressPoint[],
	metric: ProgressMetric,
	unit: WeightUnit,
): ChartDatum[] {
	const series: ChartDatum[] = [];
	for (const point of points) {
		const kg = metric === "e1rm" ? point.bestE1rmKg : point.volumeKg;
		if (kg === undefined || kg <= 0) continue;
		series.push({
			workoutId: point.workoutId,
			date: point.date,
			value: convertFromKg(kg, unit),
		});
	}
	return series;
}

/**
 * A charted value (already in `unit`) with its unit. An Estimated 1RM reads
 * like any weight ("116.7 kg"); Volume runs to thousands, where a decimal
 * place is noise, so it is whole and grouped ("12,346 lb").
 */
export function formatMetricValue(
	value: number,
	metric: ProgressMetric,
	unit: WeightUnit,
): string {
	if (metric === "volume") {
		return `${Math.round(value).toLocaleString("en-US")} ${unit}`;
	}
	return `${roundForDisplay(value)} ${unit}`;
}

/** A stored Volume in kg, shown in the given unit, e.g. "12,346 lb". */
export function formatVolume(kg: number, unit: WeightUnit): string {
	return formatMetricValue(convertFromKg(kg, unit), "volume", unit);
}
