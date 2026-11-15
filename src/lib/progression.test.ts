import { describe, expect, it } from "vitest";
import {
	deriveIncrementKg,
	type ProgressionGroup,
	type ProgressionInput,
	type ProgressionSet,
	suggestProgression,
} from "./progression";
import { KG_PER_LB } from "./units";

const DONE = 1_700_000_000_000;

/** A complete working set of `reps` at `weightKg`. */
function done(weightKg: number, reps: number): ProgressionSet {
	return { weightKg, reps, completedAt: DONE };
}

/** The single group the input gives. */
function suggestOnlyGroup(input: ProgressionInput): ProgressionGroup {
	const [group, ...rest] = suggestProgression(input);
	if (!group || rest.length > 0) throw new Error("expected exactly one group");
	return group;
}

const range = { repMin: 4, repMax: 6 };
const barbell = { incrementKg: 2.5 };

describe("suggestProgression", () => {
	it("adds the increment when every working set reached repMax", () => {
		const group = suggestOnlyGroup({
			...range,
			...barbell,
			sets: [done(100, 6), done(100, 6), done(100, 6)],
		});
		expect(group.suggestion).toEqual({
			action: "increase",
			sets: [
				{ weightKg: 102.5, reps: 4 },
				{ weightKg: 102.5, reps: 4 },
				{ weightKg: 102.5, reps: 4 },
			],
		});
	});

	it("keeps the weight and reps when any set fell below repMin", () => {
		const group = suggestOnlyGroup({
			...range,
			...barbell,
			sets: [done(100, 6), done(100, 5), done(100, 3)],
		});
		expect(group.suggestion).toEqual({
			action: "keep",
			sets: [
				{ weightKg: 100, reps: 6 },
				{ weightKg: 100, reps: 5 },
				{ weightKg: 100, reps: 3 },
			],
		});
	});

	it("keeps the weight and aims for one more rep, up to repMax, otherwise", () => {
		const group = suggestOnlyGroup({
			...range,
			...barbell,
			sets: [done(100, 6), done(100, 5), done(100, 4)],
		});
		expect(group.suggestion).toEqual({
			action: "addRep",
			sets: [
				{ weightKg: 100, reps: 6 },
				{ weightKg: 100, reps: 6 },
				{ weightKg: 100, reps: 5 },
			],
		});
	});

	it("never raises the weight because of a single set", () => {
		const group = suggestOnlyGroup({
			...range,
			...barbell,
			sets: [done(100, 8), done(100, 5), done(100, 5)],
		});
		expect(group.suggestion?.action).toBe("addRep");
	});

	it("ignores warm-up sets", () => {
		const group = suggestOnlyGroup({
			...range,
			...barbell,
			sets: [
				{ weightKg: 40, reps: 2, warmup: true, completedAt: DONE },
				{ weightKg: 60, reps: 1, warmup: true, completedAt: DONE },
				done(100, 6),
				done(100, 6),
			],
		});
		expect(group.suggestion).toEqual({
			action: "increase",
			sets: [
				{ weightKg: 102.5, reps: 4 },
				{ weightKg: 102.5, reps: 4 },
			],
		});
	});

	it("ignores incomplete sets", () => {
		const group = suggestOnlyGroup({
			...range,
			...barbell,
			sets: [done(100, 6), { weightKg: 100, reps: 2 }, done(100, 6)],
		});
		expect(group.suggestion?.action).toBe("increase");
		expect(group.suggestion?.sets).toHaveLength(2);
	});

	it("judges heavy and back-off groups separately by each set's rep range", () => {
		const heavy = { repMin: 4, repMax: 6 };
		const backOff = { repMin: 8, repMax: 10 };
		const groups = suggestProgression({
			...barbell,
			sets: [
				{ ...done(100, 6), ...heavy },
				{ ...done(100, 6), ...heavy },
				{ ...done(100, 6), ...heavy },
				{ ...done(80, 9), ...backOff },
				{ ...done(80, 8), ...backOff },
			],
		});
		expect(groups).toHaveLength(2);
		expect(groups[0]).toMatchObject({ repMin: 4, repMax: 6 });
		expect(groups[0]?.suggestion?.action).toBe("increase");
		expect(groups[1]).toMatchObject({ repMin: 8, repMax: 10 });
		expect(groups[1]?.suggestion).toEqual({
			action: "addRep",
			sets: [
				{ weightKg: 80, reps: 10 },
				{ weightKg: 80, reps: 9 },
			],
		});
	});

	it("uses the exercise's range for sets that carry none", () => {
		const groups = suggestProgression({
			repMin: 8,
			repMax: 12,
			...barbell,
			sets: [
				{ ...done(100, 5), repMin: 3, repMax: 5 },
				done(60, 12),
				done(60, 12),
			],
		});
		expect(groups.map((g) => g.suggestion?.action)).toEqual([
			"increase",
			"increase",
		]);
		expect(groups[1]?.suggestion?.sets[0]).toEqual({ weightKg: 62.5, reps: 8 });
	});

	it("gives no suggestion when there is no rep range", () => {
		const group = suggestOnlyGroup({
			...barbell,
			sets: [done(100, 6), done(100, 6)],
		});
		expect(group.repMin).toBeUndefined();
		expect(group.suggestion).toBeUndefined();
	});

	it("gives no suggestion for a group with a set lacking weight or reps", () => {
		const noWeight = suggestOnlyGroup({
			...range,
			...barbell,
			sets: [done(100, 6), { reps: 6, completedAt: DONE }],
		});
		expect(noWeight.suggestion).toBeUndefined();
		const noReps = suggestOnlyGroup({
			...range,
			...barbell,
			sets: [{ weightKg: 100, completedAt: DONE }],
		});
		expect(noReps.suggestion).toBeUndefined();
	});

	it("returns no groups when there are no complete working sets", () => {
		expect(suggestProgression({ ...range, ...barbell, sets: [] })).toEqual([]);
		expect(
			suggestProgression({
				...range,
				...barbell,
				sets: [{ weightKg: 40, reps: 5, warmup: true, completedAt: DONE }],
			}),
		).toEqual([]);
	});

	it("on a deload keeps two thirds of each group's sets at the same weights and reps", () => {
		const heavy = { repMin: 4, repMax: 6 };
		const backOff = { repMin: 8, repMax: 10 };
		const groups = suggestProgression({
			...barbell,
			deload: true,
			sets: [
				{ ...done(100, 6), ...heavy },
				{ ...done(100, 6), ...heavy },
				{ ...done(100, 6), ...heavy },
				{ ...done(80, 10), ...backOff },
				{ ...done(80, 9), ...backOff },
			],
		});
		expect(groups[0]?.suggestion).toEqual({
			action: "deload",
			sets: [
				{ weightKg: 100, reps: 6 },
				{ weightKg: 100, reps: 6 },
			],
		});
		expect(groups[1]?.suggestion).toEqual({
			action: "deload",
			sets: [{ weightKg: 80, reps: 10 }],
		});
	});

	it("keeps at least one set on a deload", () => {
		const group = suggestOnlyGroup({
			...range,
			...barbell,
			deload: true,
			sets: [done(100, 5)],
		});
		expect(group.suggestion?.sets).toEqual([{ weightKg: 100, reps: 5 }]);
	});

	it("ignores RPE", () => {
		const group = suggestOnlyGroup({
			...range,
			...barbell,
			sets: [
				{ ...done(100, 6), rpe: 10 },
				{ ...done(100, 6), rpe: 10 },
			],
		});
		expect(group.suggestion?.action).toBe("increase");
	});

	it("rounds a raised weight to a loadable step of the increment", () => {
		const group = suggestOnlyGroup({
			...range,
			...barbell,
			sets: [done(101, 6)],
		});
		expect(group.suggestion?.sets[0]?.weightKg).toBe(102.5);
	});

	it("steps per dumbbell by 2 kg", () => {
		const group = suggestOnlyGroup({
			repMin: 8,
			repMax: 12,
			incrementKg: deriveIncrementKg("Shoulder Press (Dumbbell)"),
			sets: [done(20, 12), done(20, 12)],
		});
		expect(group.suggestion?.sets[0]?.weightKg).toBe(22);
	});

	it("rounds to the pound step for a lifter who uses pounds", () => {
		const incrementKg = deriveIncrementKg("Bench Press (Barbell)", "lb");
		const group = suggestOnlyGroup({
			...range,
			incrementKg,
			unit: "lb",
			sets: [done(100, 6)],
		});
		// 100 kg is 220.46 lb; + 5 lb is 225.46 lb, loaded as 225 lb.
		expect(group.suggestion?.sets[0]?.weightKg).toBeCloseTo(225 * KG_PER_LB, 9);
	});

	it("never rewrites a kept weight", () => {
		const group = suggestOnlyGroup({
			...range,
			...barbell,
			unit: "lb",
			sets: [done(99.790321, 5)],
		});
		expect(group.suggestion?.sets[0]?.weightKg).toBe(99.790321);
	});
});

describe("deriveIncrementKg", () => {
	it("is 2.5 kg for a barbell, 2 kg per dumbbell, 2.5 kg for a machine", () => {
		expect(deriveIncrementKg("Bench Press (Barbell)")).toBe(2.5);
		expect(deriveIncrementKg("Incline Press (Dumbbell)")).toBe(2);
		expect(deriveIncrementKg("Leg Press (Machine)")).toBe(2.5);
	});

	it("defaults to 2.5 kg for any other name", () => {
		expect(deriveIncrementKg("Pull Up")).toBe(2.5);
		expect(deriveIncrementKg("Row (Cable)")).toBe(2.5);
	});

	it("matches the suffix ignoring case and trailing space", () => {
		expect(deriveIncrementKg("curl (dumbbell) ")).toBe(2);
	});

	it("uses the exercise's equipment when it has one", () => {
		expect(
			deriveIncrementKg({ name: "Incline Press", equipment: "dumbbell" }),
		).toBe(2);
		expect(deriveIncrementKg({ name: "Squat", equipment: "barbell" })).toBe(
			2.5,
		);
		expect(deriveIncrementKg({ name: "Row", equipment: "cable" })).toBe(2.5);
	});

	it("lets the equipment win over the name's suffix", () => {
		expect(
			deriveIncrementKg({ name: "Press (Dumbbell)", equipment: "machine" }),
		).toBe(2.5);
	});

	it("falls back to the name's suffix for an exercise with no equipment", () => {
		expect(deriveIncrementKg({ name: "Curl (Dumbbell)" })).toBe(2);
		expect(deriveIncrementKg({ name: "Squat" })).toBe(2.5);
	});

	it("is 5 lb for dumbbell equipment too, in pounds", () => {
		expect(
			deriveIncrementKg({ name: "Curl", equipment: "dumbbell" }, "lb"),
		).toBeCloseTo(5 * KG_PER_LB, 9);
	});

	it("is 5 lb, in kilograms, for a lifter who uses pounds", () => {
		expect(deriveIncrementKg("Bench Press (Barbell)", "lb")).toBeCloseTo(
			5 * KG_PER_LB,
			9,
		);
		expect(deriveIncrementKg("Curl (Dumbbell)", "lb")).toBeCloseTo(
			5 * KG_PER_LB,
			9,
		);
	});
});
