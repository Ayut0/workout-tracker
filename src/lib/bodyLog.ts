/**
 * The body log's form and charts (ADR-0015): reading what the user typed,
 * and body weight and waist over time. Body weight follows the weight unit
 * setting; waist is always in centimetres.
 */
import {
	type BodyEntryInput,
	MAX_BODY_WEIGHT_KG,
	MAX_WAIST_CM,
	parseLocalDay,
} from "../db/bodyLog";
import type { BodyEntry, WeightUnit } from "../db/types";
import type { ChartDatum } from "./progress";
import {
	convertFromKg,
	convertToKg,
	formatWeightValue,
	parseDecimalInput,
	roundForDisplay,
} from "./units";

/** A measurement the body log charts. */
export type BodyMeasure = "bodyWeight" | "waist";

/** The unit waist is entered, stored and shown in. */
export const WAIST_UNIT = "cm";

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

/** An epoch-ms time's local calendar day, "YYYY-MM-DD"; a date input's value. */
export function formatLocalDay(epochMs: number): string {
	const d = new Date(epochMs);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The end of the chart ranges for a given "today": its local midnight, so the
 * ranges follow the day shown rather than the moment the screen opened.
 */
export function chartEndForDay(today: string): number {
	return parseLocalDay(today) ?? Date.now();
}

/** The body log form as typed: a day and two number fields. */
export interface BodyEntryForm {
	date: string;
	bodyWeight: string;
	waist: string;
}

export type BodyEntryFormResult =
	| { ok: true; input: BodyEntryInput }
	| { ok: false; field: keyof BodyEntryForm; message: string };

/** A positive number typed in a field (decimal comma accepted), or undefined. */
function parsePositive(text: string): number | undefined {
	const value = parseDecimalInput(text);
	return value !== undefined && value > 0 ? value : undefined;
}

/**
 * Reads the body log form: body weight in the user's unit becomes kg, waist
 * is cm. A blank field is a measurement not taken; at least one is needed.
 * `stored` is the day's saved entry, if any: a field still showing its value
 * as the form shows it keeps the stored value exactly, so saving the day
 * again never rounds what was stored (e.g. 70.25 kg shown as "70.3").
 */
export function parseBodyEntryForm(
	form: BodyEntryForm,
	unit: WeightUnit,
	stored?: BodyEntry,
): BodyEntryFormResult {
	if (parseLocalDay(form.date) === undefined) {
		return { ok: false, field: "date", message: "Choose a day." };
	}
	const weightText = form.bodyWeight.trim();
	const waistText = form.waist.trim();
	if (weightText === "" && waistText === "") {
		return {
			ok: false,
			field: "bodyWeight",
			message: "Enter a body weight, a waist measurement or both.",
		};
	}
	const typedWeight = weightText === "" ? undefined : parsePositive(weightText);
	const bodyWeightKg =
		typedWeight === undefined ? undefined : convertToKg(typedWeight, unit);
	if (
		weightText !== "" &&
		(bodyWeightKg === undefined || bodyWeightKg > MAX_BODY_WEIGHT_KG)
	) {
		return {
			ok: false,
			field: "bodyWeight",
			message: `Enter body weight in ${unit}, e.g. 72.5.`,
		};
	}
	const waistCm = waistText === "" ? undefined : parsePositive(waistText);
	if (waistText !== "" && (waistCm === undefined || waistCm > MAX_WAIST_CM)) {
		return {
			ok: false,
			field: "waist",
			message: `Enter waist in ${WAIST_UNIT}, e.g. 80.5.`,
		};
	}
	const shown =
		stored?.date === form.date
			? toBodyEntryForm(stored, form.date, unit)
			: undefined;
	const keptWeightKg =
		shown !== undefined && weightText === shown.bodyWeight
			? stored?.bodyWeightKg
			: bodyWeightKg;
	const keptWaistCm =
		shown !== undefined && waistText === shown.waist
			? stored?.waistCm
			: waistCm;
	return {
		ok: true,
		input: {
			date: form.date,
			...(keptWeightKg === undefined ? {} : { bodyWeightKg: keptWeightKg }),
			...(keptWaistCm === undefined ? {} : { waistCm: keptWaistCm }),
		},
	};
}

/** The form for a day: its stored measurements in the user's unit, or blank. */
export function toBodyEntryForm(
	entry: BodyEntry | undefined,
	date: string,
	unit: WeightUnit,
): BodyEntryForm {
	return {
		date,
		bodyWeight:
			entry?.bodyWeightKg === undefined
				? ""
				: formatWeightValue(entry.bodyWeightKg, unit),
		waist:
			entry?.waistCm === undefined
				? ""
				: String(roundForDisplay(entry.waistCm)),
	};
}

/**
 * One measurement over time, in the order given (listBodyEntries gives the
 * oldest day first): body weight in the user's unit, unrounded, or waist in
 * cm. Days without the measurement are left out.
 */
export function buildBodySeries(
	entries: readonly BodyEntry[],
	measure: BodyMeasure,
	unit: WeightUnit,
): ChartDatum[] {
	const series: ChartDatum[] = [];
	for (const entry of entries) {
		const stored =
			measure === "bodyWeight" ? entry.bodyWeightKg : entry.waistCm;
		const date = parseLocalDay(entry.date);
		if (stored === undefined || date === undefined) continue;
		series.push({
			id: entry.id,
			date,
			value: measure === "bodyWeight" ? convertFromKg(stored, unit) : stored,
		});
	}
	return series;
}

/** A charted value (already in its display unit) with its unit, e.g. "72.5 kg". */
export function formatBodyValue(
	value: number,
	measure: BodyMeasure,
	unit: WeightUnit,
): string {
	return `${roundForDisplay(value)} ${measure === "bodyWeight" ? unit : WAIST_UNIT}`;
}
