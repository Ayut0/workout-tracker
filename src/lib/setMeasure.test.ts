import { describe, expect, it } from "vitest";
import { MEASURE_FIELDS } from "../db/types";
import { resolveMeasure } from "../db/workoutLog";
import {
	describeFieldColumn,
	describeFieldInput,
	describeMeasure,
	formatDistance,
	formatFieldInput,
	formatSetSeconds,
	isSetMeasure,
	readFieldInput,
} from "./setMeasure";

describe("resolveMeasure", () => {
	it("is weight and reps when the exercise stores none", () => {
		expect(resolveMeasure({})).toBe("weight-reps");
		expect(resolveMeasure(undefined)).toBe("weight-reps");
	});

	it("is the exercise's own measure", () => {
		expect(resolveMeasure({ measure: "seconds" })).toBe("seconds");
		expect(resolveMeasure({ measure: "distance" })).toBe("distance");
		expect(resolveMeasure({ measure: "reps" })).toBe("reps");
	});
});

describe("MEASURE_FIELDS", () => {
	it("names the set fields each measure shows", () => {
		expect(MEASURE_FIELDS["weight-reps"]).toEqual(["weightKg", "reps"]);
		expect(MEASURE_FIELDS.reps).toEqual(["reps"]);
		expect(MEASURE_FIELDS.seconds).toEqual(["seconds"]);
		expect(MEASURE_FIELDS.distance).toEqual(["distanceM"]);
	});
});

describe("isSetMeasure", () => {
	it("accepts only the four measures", () => {
		expect(isSetMeasure("weight-reps")).toBe(true);
		expect(isSetMeasure("distance")).toBe(true);
		expect(isSetMeasure("calories")).toBe(false);
		expect(isSetMeasure(undefined)).toBe(false);
	});
});

describe("describeMeasure", () => {
	it("labels every measure", () => {
		expect(describeMeasure("weight-reps")).toBe("Weight and reps");
		expect(describeMeasure("reps")).toBe("Reps only");
		expect(describeMeasure("seconds")).toBe("Time (seconds)");
		expect(describeMeasure("distance")).toBe("Distance (metres)");
	});
});

describe("formatSetSeconds", () => {
	it("shows seconds under a minute, else minutes and seconds", () => {
		expect(formatSetSeconds(45)).toBe("45 s");
		expect(formatSetSeconds(0)).toBe("0 s");
		expect(formatSetSeconds(60)).toBe("1:00");
		expect(formatSetSeconds(95)).toBe("1:35");
	});

	it("rounds fractional seconds, carrying into the minute", () => {
		expect(formatSetSeconds(65.5)).toBe("1:06");
		expect(formatSetSeconds(59.6)).toBe("1:00");
		expect(formatSetSeconds(44.4)).toBe("44 s");
	});
});

describe("set field inputs", () => {
	it("head each column for the user's unit", () => {
		expect(describeFieldColumn("weightKg", "lb")).toBe("lb");
		expect(describeFieldColumn("reps", "kg")).toBe("Reps");
		expect(describeFieldColumn("seconds", "kg")).toBe("Sec");
		expect(describeFieldColumn("distanceM", "kg")).toBe("m");
		expect(describeFieldInput("weightKg", "kg")).toBe("weight (kg)");
		expect(describeFieldInput("seconds", "kg")).toBe("time (seconds)");
		expect(describeFieldInput("distanceM", "kg")).toBe("distance (m)");
	});

	it("show stored values, weight in the user's unit", () => {
		expect(formatFieldInput("weightKg", 100, "lb")).toBe("220.5");
		expect(formatFieldInput("reps", 8, "kg")).toBe("8");
		expect(formatFieldInput("seconds", 90, "kg")).toBe("90");
		expect(formatFieldInput("distanceM", 20.25, "kg")).toBe("20.3");
		expect(formatFieldInput("seconds", undefined, "kg")).toBe("");
	});

	it("show fractional seconds as a whole number the field reads back", () => {
		for (const stored of [65.5, 59.6, 0.4, 90]) {
			const shown = formatFieldInput("seconds", stored, "kg");
			expect(shown).toBe(String(Math.round(stored)));
			expect(readFieldInput("seconds", shown, "kg")).toEqual({
				ok: true,
				value: Math.round(stored),
			});
		}
	});

	it("read typed text with each field's rules", () => {
		expect(readFieldInput("weightKg", "10", "kg")).toEqual({
			ok: true,
			value: 10,
		});
		expect(readFieldInput("reps", "8.5", "kg")).toEqual({ ok: false });
		expect(readFieldInput("seconds", "1:30", "kg")).toEqual({
			ok: true,
			value: 90,
		});
		expect(readFieldInput("distanceM", "40,5", "kg")).toEqual({
			ok: true,
			value: 40.5,
		});
		expect(readFieldInput("distanceM", "", "kg")).toEqual({
			ok: true,
			value: undefined,
		});
	});
});

describe("formatDistance", () => {
	it("shows metres, to one decimal place at most", () => {
		expect(formatDistance(400)).toBe("400 m");
		expect(formatDistance(20.25)).toBe("20.3 m");
	});
});
