import type { MeasureField, SetMeasure } from "./types";

/** Every measure, in the order the library offers them. */
export const SET_MEASURES = [
	"weight-reps",
	"reps",
	"seconds",
	"distance",
] as const satisfies readonly SetMeasure[];

/** The measure of an exercise that has none stored. */
export const DEFAULT_SET_MEASURE: SetMeasure = "weight-reps";

/** The set fields each measure shows, in column order. */
export const MEASURE_FIELDS: Record<SetMeasure, readonly MeasureField[]> = {
	"weight-reps": ["weightKg", "reps"],
	reps: ["reps"],
	seconds: ["seconds"],
	distance: ["distanceM"],
};
