import { describe, expect, it } from "vitest";
import { KG_PER_LB } from "./units";
import {
	formatElapsed,
	nameWorkoutFor,
	readRepsField,
	readWeightField,
} from "./workoutLog";

/** Epoch ms for a local time today-ish; the hour is what matters. */
function atLocalHour(hour: number): number {
	return new Date(2026, 10, 6, hour, 30).getTime();
}

describe("nameWorkoutFor", () => {
	it("names a workout after the part of the day it starts in", () => {
		expect(nameWorkoutFor(atLocalHour(7))).toBe("Morning workout");
		expect(nameWorkoutFor(atLocalHour(12))).toBe("Afternoon workout");
		expect(nameWorkoutFor(atLocalHour(18))).toBe("Evening workout");
		expect(nameWorkoutFor(atLocalHour(23))).toBe("Night workout");
		expect(nameWorkoutFor(atLocalHour(2))).toBe("Night workout");
	});
});

describe("formatElapsed", () => {
	it("shows minutes and seconds under an hour", () => {
		expect(formatElapsed(0)).toBe("0:00");
		expect(formatElapsed(245_999)).toBe("4:05");
	});

	it("shows hours once past an hour", () => {
		expect(formatElapsed((3_600 + 2 * 60 + 3) * 1_000)).toBe("1:02:03");
	});

	it("never shows a negative time", () => {
		expect(formatElapsed(-5_000)).toBe("0:00");
	});
});

describe("readWeightField", () => {
	it("reads kg as typed and lb converted to kg", () => {
		expect(readWeightField("62.5", "kg")).toEqual({ ok: true, value: 62.5 });
		expect(readWeightField("100", "lb")).toEqual({
			ok: true,
			value: 100 * KG_PER_LB,
		});
	});

	it("accepts a decimal comma", () => {
		expect(readWeightField("62,5", "kg")).toEqual({ ok: true, value: 62.5 });
	});

	it("clears on blank text and rejects text that is not a weight", () => {
		expect(readWeightField("  ", "kg")).toEqual({ ok: true, value: undefined });
		expect(readWeightField("abc", "kg")).toEqual({ ok: false });
		expect(readWeightField("-5", "kg")).toEqual({ ok: false });
	});
});

describe("readRepsField", () => {
	it("reads whole reps, 0 included", () => {
		expect(readRepsField("8")).toEqual({ ok: true, value: 8 });
		expect(readRepsField("0")).toEqual({ ok: true, value: 0 });
	});

	it("clears on blank text and rejects anything else", () => {
		expect(readRepsField("")).toEqual({ ok: true, value: undefined });
		expect(readRepsField("8.5")).toEqual({ ok: false });
		expect(readRepsField("x")).toEqual({ ok: false });
	});
});
