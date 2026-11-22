import { describe, expect, it } from "vitest";
import { formatPreviousSet, planFillFromPrevious } from "./previousSets";

describe("formatPreviousSet", () => {
	it("shows weight × reps in the user's unit", () => {
		expect(formatPreviousSet({ weightKg: 100, reps: 5 }, "kg")).toBe(
			"100 kg × 5",
		);
		expect(formatPreviousSet({ weightKg: 100, reps: 5 }, "lb")).toBe(
			"220.5 lb × 5",
		);
	});

	it("shows only what was recorded", () => {
		expect(formatPreviousSet({ weightKg: 60 }, "kg")).toBe("60 kg");
		expect(formatPreviousSet({ reps: 12 }, "kg")).toBe("12 reps");
		expect(formatPreviousSet({ reps: 1 }, "kg")).toBe("1 rep");
		expect(formatPreviousSet({ weightKg: 0, reps: 10 }, "kg")).toBe(
			"0 kg × 10",
		);
	});

	it("is undefined for a set with neither weight nor reps", () => {
		expect(formatPreviousSet({}, "kg")).toBeUndefined();
		expect(formatPreviousSet({ seconds: 30 }, "kg")).toBeUndefined();
	});

	it("shows only the exercise's measure", () => {
		const set = { weightKg: 20, reps: 12, seconds: 45, distanceM: 400 };
		expect(formatPreviousSet(set, "kg", "reps")).toBe("12 reps");
		expect(formatPreviousSet(set, "kg", "seconds")).toBe("45 s");
		expect(formatPreviousSet(set, "kg", "distance")).toBe("400 m");
		expect(formatPreviousSet({ seconds: 90 }, "kg", "seconds")).toBe("1:30");
	});

	it("is undefined when the set lacks the measure's field", () => {
		expect(formatPreviousSet({ weightKg: 60 }, "kg", "reps")).toBeUndefined();
		expect(formatPreviousSet({ reps: 5 }, "kg", "seconds")).toBeUndefined();
		expect(formatPreviousSet({ reps: 5 }, "kg", "distance")).toBeUndefined();
	});
});

describe("planFillFromPrevious", () => {
	it("copies the stored kilograms and reps unrounded", () => {
		expect(planFillFromPrevious({ weightKg: 99.790321, reps: 5 })).toEqual({
			weightKg: 99.790321,
			reps: 5,
		});
	});

	it("leaves out what the previous set lacks", () => {
		expect(planFillFromPrevious({ reps: 8 })).toEqual({ reps: 8 });
		expect(planFillFromPrevious({ weightKg: 40 })).toEqual({ weightKg: 40 });
		expect(planFillFromPrevious({})).toEqual({});
	});

	it("copies only the fields of the exercise's measure", () => {
		const set = { weightKg: 20, reps: 12, seconds: 45, distanceM: 37.5 };
		expect(planFillFromPrevious(set)).toEqual({ weightKg: 20, reps: 12 });
		expect(planFillFromPrevious(set, "reps")).toEqual({ reps: 12 });
		expect(planFillFromPrevious(set, "seconds")).toEqual({ seconds: 45 });
		expect(planFillFromPrevious(set, "distance")).toEqual({ distanceM: 37.5 });
		expect(planFillFromPrevious({ reps: 5 }, "seconds")).toEqual({});
	});
});
