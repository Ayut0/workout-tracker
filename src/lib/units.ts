import type { WeightUnit } from "../db/types";

/**
 * Weight conversion and rounding for display and input.
 *
 * Weight is stored in kilograms, unrounded (ADR-0002). These helpers convert
 * to the user's weight unit only at the edge: when showing a weight and when
 * reading one the user typed. Never round a stored value and write it back.
 */

/** The international pound, exactly. */
export const KG_PER_LB = 0.45359237;

/** Decimal places shown for a weight. */
const DISPLAY_DECIMALS = 1;

/** The smallest jump on a loaded bar, per unit: 2 × 1.25 kg or 2 × 2.5 lb. */
export const PLATE_INCREMENT: Record<WeightUnit, number> = { kg: 2.5, lb: 5 };

/** A weight in kilograms expressed in the given unit, unrounded. */
export function convertFromKg(kg: number, unit: WeightUnit): number {
	return unit === "lb" ? kg / KG_PER_LB : kg;
}

/** A weight in the given unit expressed in kilograms, unrounded. */
export function convertToKg(value: number, unit: WeightUnit): number {
	return unit === "lb" ? value * KG_PER_LB : value;
}

/** Rounds a value for display, to one decimal place by default. */
export function roundForDisplay(
	value: number,
	decimals: number = DISPLAY_DECIMALS,
): number {
	const factor = 10 ** decimals;
	// Nudge by EPSILON so 1.25 rounds to 1.3, not 1.2 (1.25 * 10 is 12.499…).
	return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** A stored weight as a number string in the given unit, e.g. "220.5"; for inputs. */
export function formatWeightValue(kg: number, unit: WeightUnit): string {
	return String(roundForDisplay(convertFromKg(kg, unit)));
}

/** A stored weight with its unit, e.g. 100 kg in pounds is "220.5 lb". */
export function formatWeight(kg: number, unit: WeightUnit): string {
	return `${formatWeightValue(kg, unit)} ${unit}`;
}

const WEIGHT_INPUT = /^\d+(?:[.,]\d*)?$|^[.,]\d+$/;

/**
 * Reads a weight the user typed in the given unit and returns kilograms, or
 * undefined when the text is not a non-negative number. A decimal comma is
 * accepted, as phone keypads in many locales offer one.
 */
export function parseWeightInput(
	text: string,
	unit: WeightUnit,
): number | undefined {
	const trimmed = text.trim();
	if (!WEIGHT_INPUT.test(trimmed)) return undefined;
	return convertToKg(Number(trimmed.replace(",", ".")), unit);
}

/**
 * Rounds a weight to what can be loaded on a bar in the given unit (nearest
 * 2.5 kg or 5 lb by default) and returns it in kilograms. For suggesting
 * weights, never for rewriting stored ones.
 */
export function roundToPlateIncrement(
	kg: number,
	unit: WeightUnit,
	increment: number = PLATE_INCREMENT[unit],
): number {
	const value = convertFromKg(kg, unit);
	return convertToKg(Math.round(value / increment) * increment, unit);
}
