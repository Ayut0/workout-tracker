import {
	type MeasureField,
	SET_MEASURES,
	type SetMeasure,
	type WeightUnit,
} from "../db/types";
import { formatWeightValue, roundForDisplay } from "./units";
import {
	readDistanceField,
	readRepsField,
	readSecondsField,
	readWeightField,
	type SetFieldInput,
} from "./workoutLog";

/**
 * What a set records, per exercise (ADR-0012). The exercise's measure picks
 * which set fields the set row, the Previous column and template planned sets
 * show; the other fields are kept as stored, only hidden. Resolving an
 * exercise's measure (resolveMeasure) lives in src/db/workoutLog.ts, since
 * the writes need it too.
 */

const SECONDS_PER_MINUTE = 60;

/** Whether a value (such as a select's) names a measure. */
export function isSetMeasure(value: unknown): value is SetMeasure {
	return SET_MEASURES.some((measure) => measure === value);
}

/** How the library names a measure. */
export function describeMeasure(measure: SetMeasure): string {
	switch (measure) {
		case "weight-reps":
			return "Weight and reps";
		case "reps":
			return "Reps only";
		case "seconds":
			return "Time (seconds)";
		case "distance":
			return "Distance (metres)";
	}
}

/** A set's time: "45 s" under a minute, else "1:35". */
export function formatSetSeconds(seconds: number): string {
	if (seconds < SECONDS_PER_MINUTE) return `${seconds} s`;
	const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
	const rest = seconds % SECONDS_PER_MINUTE;
	return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/** A set's distance in metres, e.g. "400 m". */
export function formatDistance(metres: number): string {
	return `${roundForDisplay(metres)} m`;
}

/** A field's column heading in a set grid, e.g. "kg", "Reps", "Sec", "m". */
export function describeFieldColumn(
	field: MeasureField,
	unit: WeightUnit,
): string {
	switch (field) {
		case "weightKg":
			return unit;
		case "reps":
			return "Reps";
		case "seconds":
			return "Sec";
		case "distanceM":
			return "m";
	}
}

/** What a field's input is called after the set's name, e.g. "weight (kg)". */
export function describeFieldInput(
	field: MeasureField,
	unit: WeightUnit,
): string {
	switch (field) {
		case "weightKg":
			return `weight (${unit})`;
		case "reps":
			return "reps";
		case "seconds":
			return "time (seconds)";
		case "distanceM":
			return "distance (m)";
	}
}

/** A stored value as an input shows it: weight in the user's unit, the rest as numbers. */
export function formatFieldInput(
	field: MeasureField,
	value: number | undefined,
	unit: WeightUnit,
): string {
	if (value === undefined) return "";
	switch (field) {
		case "weightKg":
			return formatWeightValue(value, unit);
		case "distanceM":
			return String(roundForDisplay(value));
		case "reps":
		case "seconds":
			return String(value);
	}
}

/** Reads what was typed into a field's input; weight is typed in the user's unit. */
export function readFieldInput(
	field: MeasureField,
	text: string,
	unit: WeightUnit,
): SetFieldInput {
	switch (field) {
		case "weightKg":
			return readWeightField(text, unit);
		case "reps":
			return readRepsField(text);
		case "seconds":
			return readSecondsField(text);
		case "distanceM":
			return readDistanceField(text);
	}
}
