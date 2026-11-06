import { describe, expect, it } from "vitest";
import {
	convertFromKg,
	convertToKg,
	formatWeight,
	formatWeightValue,
	KG_PER_LB,
	parseWeightInput,
	roundForDisplay,
	roundToPlateIncrement,
} from "./units";

describe("convertFromKg / convertToKg", () => {
	it("leaves kilograms as they are", () => {
		expect(convertFromKg(100, "kg")).toBe(100);
		expect(convertToKg(100, "kg")).toBe(100);
	});

	it("converts with the exact pound definition", () => {
		expect(convertToKg(1, "lb")).toBe(KG_PER_LB);
		expect(convertFromKg(100, "lb")).toBeCloseTo(220.462_262, 6);
	});

	it("round-trips without drift", () => {
		expect(convertFromKg(convertToKg(225, "lb"), "lb")).toBeCloseTo(225, 10);
	});
});

describe("roundForDisplay", () => {
	it("rounds to one decimal place", () => {
		expect(roundForDisplay(220.462)).toBe(220.5);
		expect(roundForDisplay(102.04)).toBe(102);
		expect(roundForDisplay(1.25)).toBe(1.3);
	});
});

describe("formatWeight", () => {
	it("shows 100 kg as 220.5 lb", () => {
		expect(formatWeight(100, "lb")).toBe("220.5 lb");
	});

	it("shows kilograms without trailing zeros", () => {
		expect(formatWeight(100, "kg")).toBe("100 kg");
		expect(formatWeight(102.5, "kg")).toBe("102.5 kg");
	});

	it("shows a weight entered in pounds as entered", () => {
		expect(formatWeight(convertToKg(225, "lb"), "lb")).toBe("225 lb");
	});

	it("formats the number alone for prefilling an input", () => {
		expect(formatWeightValue(100, "lb")).toBe("220.5");
		expect(formatWeightValue(60, "kg")).toBe("60");
	});
});

describe("parseWeightInput", () => {
	it("reads kilograms as typed", () => {
		expect(parseWeightInput("102.5", "kg")).toBe(102.5);
	});

	it("reads pounds and stores kilograms", () => {
		expect(parseWeightInput("225", "lb")).toBeCloseTo(102.058, 3);
	});

	it("accepts a decimal comma and surrounding spaces", () => {
		expect(parseWeightInput(" 82,5 ", "kg")).toBe(82.5);
	});

	it("accepts zero", () => {
		expect(parseWeightInput("0", "kg")).toBe(0);
	});

	it("rejects empty, negative and non-numeric input", () => {
		expect(parseWeightInput("", "kg")).toBeUndefined();
		expect(parseWeightInput("  ", "lb")).toBeUndefined();
		expect(parseWeightInput("-5", "kg")).toBeUndefined();
		expect(parseWeightInput("abc", "kg")).toBeUndefined();
		expect(parseWeightInput("12kg", "kg")).toBeUndefined();
		expect(parseWeightInput("Infinity", "kg")).toBeUndefined();
	});
});

describe("roundToPlateIncrement", () => {
	it("rounds to the nearest 2.5 kg", () => {
		expect(roundToPlateIncrement(101, "kg")).toBe(100);
		expect(roundToPlateIncrement(101.3, "kg")).toBe(102.5);
	});

	it("rounds to the nearest 5 lb and returns kilograms", () => {
		const kg = roundToPlateIncrement(102, "lb");
		expect(convertFromKg(kg, "lb")).toBeCloseTo(225, 10);
		expect(formatWeight(kg, "lb")).toBe("225 lb");
	});

	it("takes a custom increment in the display unit", () => {
		expect(roundToPlateIncrement(101, "kg", 1.25)).toBe(101.25);
	});
});
