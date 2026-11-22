import { describe, expect, it } from "vitest";
import { KG_PER_LB } from "./units";
import {
	buildWorkoutName,
	formatElapsed,
	MAX_DISTANCE_M,
	MAX_REPS,
	MAX_SECONDS,
	readDistanceField,
	readRepsField,
	readSecondsField,
	readWeightField,
} from "./workoutLog";

/** Epoch ms for a local time today-ish; the hour is what matters. */
function buildLocalHourTimestamp(hour: number): number {
	return new Date(2026, 10, 6, hour, 30).getTime();
}

describe("buildWorkoutName", () => {
	it("names a workout after the part of the day it starts in", () => {
		expect(buildWorkoutName(buildLocalHourTimestamp(7))).toBe(
			"Morning workout",
		);
		expect(buildWorkoutName(buildLocalHourTimestamp(12))).toBe(
			"Afternoon workout",
		);
		expect(buildWorkoutName(buildLocalHourTimestamp(18))).toBe(
			"Evening workout",
		);
		expect(buildWorkoutName(buildLocalHourTimestamp(23))).toBe("Night workout");
		expect(buildWorkoutName(buildLocalHourTimestamp(2))).toBe("Night workout");
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

	it("caps reps at MAX_REPS and rejects values that overflow", () => {
		expect(readRepsField(String(MAX_REPS))).toEqual({
			ok: true,
			value: MAX_REPS,
		});
		expect(readRepsField(String(MAX_REPS + 1))).toEqual({ ok: false });
		expect(readRepsField("9".repeat(20))).toEqual({ ok: false });
		expect(readRepsField("9".repeat(400))).toEqual({ ok: false });
	});
});

describe("readSecondsField", () => {
	it("reads whole seconds, or minutes and seconds", () => {
		expect(readSecondsField("45")).toEqual({ ok: true, value: 45 });
		expect(readSecondsField(" 0 ")).toEqual({ ok: true, value: 0 });
		expect(readSecondsField("1:30")).toEqual({ ok: true, value: 90 });
		expect(readSecondsField("10:05")).toEqual({ ok: true, value: 605 });
	});

	it("clears on blank text and rejects anything else", () => {
		expect(readSecondsField("")).toEqual({ ok: true, value: undefined });
		expect(readSecondsField("1:")).toEqual({ ok: false });
		expect(readSecondsField("1:75")).toEqual({ ok: false });
		expect(readSecondsField("4.5")).toEqual({ ok: false });
		expect(readSecondsField("-3")).toEqual({ ok: false });
		expect(readSecondsField("1:30:00")).toEqual({ ok: false });
		expect(readSecondsField("1:5")).toEqual({ ok: false });
	});

	it("caps time at MAX_SECONDS and rejects values that overflow", () => {
		expect(readSecondsField(String(MAX_SECONDS))).toEqual({
			ok: true,
			value: MAX_SECONDS,
		});
		expect(readSecondsField(String(MAX_SECONDS + 1))).toEqual({ ok: false });
		expect(readSecondsField("1440:01")).toEqual({ ok: false });
		expect(readSecondsField("1440:00")).toEqual({ ok: true, value: 86400 });
		expect(readSecondsField("9".repeat(20))).toEqual({ ok: false });
		expect(readSecondsField("9".repeat(400))).toEqual({ ok: false });
	});
});

describe("readDistanceField", () => {
	it("reads metres, with a decimal point or comma", () => {
		expect(readDistanceField("400")).toEqual({ ok: true, value: 400 });
		expect(readDistanceField("20.5")).toEqual({ ok: true, value: 20.5 });
		expect(readDistanceField("20,5")).toEqual({ ok: true, value: 20.5 });
		expect(readDistanceField("0")).toEqual({ ok: true, value: 0 });
	});

	it("clears on blank text and rejects anything else", () => {
		expect(readDistanceField(" ")).toEqual({ ok: true, value: undefined });
		expect(readDistanceField("-5")).toEqual({ ok: false });
		expect(readDistanceField("5 km")).toEqual({ ok: false });
	});

	it("caps distance at MAX_DISTANCE_M and rejects values that overflow", () => {
		expect(readDistanceField(String(MAX_DISTANCE_M))).toEqual({
			ok: true,
			value: MAX_DISTANCE_M,
		});
		expect(readDistanceField(`${MAX_DISTANCE_M + 1}`)).toEqual({ ok: false });
		expect(readDistanceField("9".repeat(20))).toEqual({ ok: false });
		expect(readDistanceField("9".repeat(400))).toEqual({ ok: false });
		expect(readDistanceField(`${"9".repeat(400)},5`)).toEqual({ ok: false });
	});
});
