import { describe, expect, it } from "vitest";
import {
	describePlannedTargets,
	formatRepRange,
	formatRir,
	readRepRangeInput,
	readRirInput,
} from "./plannedTargets";

describe("readRepRangeInput", () => {
	it.each([
		["8", 8, 8],
		[" 8 ", 8, 8],
		["0", 0, 0],
		["6-8", 6, 8],
		["6–8", 6, 8],
		["6—8", 6, 8],
		["6 - 8", 6, 8],
		["6 to 8", 6, 8],
		["8-8", 8, 8],
	])("reads %j as %i to %i", (text, repMin, repMax) => {
		expect(readRepRangeInput(text)).toEqual({ ok: true, repMin, repMax });
	});

	it("clears the range when blank", () => {
		expect(readRepRangeInput("  ")).toEqual({
			ok: true,
			repMin: undefined,
			repMax: undefined,
		});
	});

	it.each(["8-6", "6-", "-8", "6.5", "6-8.5", "-3", "six", "6-8-10"])(
		"refuses %j",
		(text) => {
			expect(readRepRangeInput(text)).toEqual({ ok: false });
		},
	);
});

describe("readRirInput", () => {
	it("reads a whole number, 0 or more, and clears when blank", () => {
		expect(readRirInput("2")).toEqual({ ok: true, value: 2 });
		expect(readRirInput(" 0 ")).toEqual({ ok: true, value: 0 });
		expect(readRirInput("")).toEqual({ ok: true, value: undefined });
	});

	it.each(["-1", "1.5", "two"])("refuses %j", (text) => {
		expect(readRirInput(text)).toEqual({ ok: false });
	});
});

describe("formatting targets for their fields", () => {
	it("shows a range, a single number for equal ends, or nothing", () => {
		expect(formatRepRange(6, 8)).toBe("6–8");
		expect(formatRepRange(8, 8)).toBe("8");
		expect(formatRepRange(undefined, undefined)).toBe("");
		expect(formatRepRange(6, undefined)).toBe("6");
		expect(formatRepRange(undefined, 8)).toBe("8");
	});

	it("round-trips through the reader", () => {
		expect(readRepRangeInput(formatRepRange(4, 6))).toEqual({
			ok: true,
			repMin: 4,
			repMax: 6,
		});
	});

	it("shows a target RIR, or nothing", () => {
		expect(formatRir(2)).toBe("2");
		expect(formatRir(0)).toBe("0");
		expect(formatRir(undefined)).toBe("");
	});
});

describe("describePlannedTargets", () => {
	it("describes a range and RIR together", () => {
		expect(describePlannedTargets({ repMin: 4, repMax: 6, targetRir: 2 })).toBe(
			"4–6 reps · RIR 2",
		);
	});

	it("describes either alone", () => {
		expect(describePlannedTargets({ repMin: 8, repMax: 8 })).toBe("8 reps");
		expect(describePlannedTargets({ repMin: 1, repMax: 1 })).toBe("1 rep");
		expect(describePlannedTargets({ targetRir: 0 })).toBe("RIR 0");
	});

	it("is undefined with no targets", () => {
		expect(describePlannedTargets({})).toBeUndefined();
	});
});
