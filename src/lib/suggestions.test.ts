import { describe, expect, it } from "vitest";
import type { WorkoutSet } from "../db/types";
import {
	describeSuggestion,
	findFirstOccurrenceIds,
	suggestForExercise,
} from "./suggestions";
import type { ExerciseSuggestion, SuggestionInput } from "./types";
import { KG_PER_LB } from "./units";

const DONE = 1_700_000_000_000;

/** A complete set from the last workout. */
function last(
	weightKg: number,
	reps: number,
	extra: Partial<WorkoutSet> = {},
): WorkoutSet {
	return {
		id: `last-${weightKg}-${reps}-${Math.random()}`,
		workoutExerciseId: "last",
		order: 0,
		weightKg,
		reps,
		completedAt: DONE,
		...extra,
	};
}

/** Today's set `id`, as copied from a template. */
function today(id: string, extra: Partial<WorkoutSet> = {}): WorkoutSet {
	return { id, workoutExerciseId: "today", order: 0, ...extra };
}

const heavy = { repMin: 4, repMax: 6 };
const backOff = { repMin: 8, repMax: 10 };

function input(overrides: Partial<SuggestionInput>): SuggestionInput {
	return {
		sets: [],
		previous: [],
		measure: "weight-reps",
		exercise: { name: "Bench Press (Barbell)" },
		unit: "kg",
		...overrides,
	};
}

function onlySuggestion(found: ExerciseSuggestion[]): ExerciseSuggestion {
	const [suggestion, ...rest] = found;
	if (!suggestion || rest.length > 0) {
		throw new Error("expected exactly one suggestion");
	}
	return suggestion;
}

describe("suggestForExercise", () => {
	it("raises the weight when every set reached the top of the range, and fills today's working sets", () => {
		const suggestion = onlySuggestion(
			suggestForExercise(
				input({
					sets: [today("a", heavy), today("b", heavy)],
					previous: [last(100, 6, heavy), last(100, 6, heavy)],
				}),
			),
		);

		expect(suggestion).toEqual({
			action: "increase",
			repMin: 4,
			repMax: 6,
			sets: [
				{ weightKg: 102.5, reps: 4 },
				{ weightKg: 102.5, reps: 4 },
			],
			fills: [
				{ setId: "a", changes: { weightKg: 102.5, reps: 4 } },
				{ setId: "b", changes: { weightKg: 102.5, reps: 4 } },
			],
		});
	});

	it("never fills a warm-up, which keeps its planned values", () => {
		const suggestion = onlySuggestion(
			suggestForExercise(
				input({
					sets: [
						today("w", { warmup: true, weightKg: 60, reps: 5 }),
						today("a", heavy),
					],
					previous: [last(60, 5, { warmup: true }), last(100, 5, heavy)],
				}),
			),
		);

		expect(suggestion.action).toBe("addRep");
		expect(suggestion.fills).toEqual([
			{ setId: "a", changes: { weightKg: 100, reps: 6 } },
		]);
	});

	it("judges heavy and back-off sets as separate groups", () => {
		const found = suggestForExercise(
			input({
				sets: [today("h1", heavy), today("h2", heavy), today("b1", backOff)],
				previous: [
					last(100, 6, heavy),
					last(100, 6, heavy),
					last(80, 7, backOff),
				],
			}),
		);

		expect(found.map((s) => [s.action, s.fills.map((f) => f.setId)])).toEqual([
			["increase", ["h1", "h2"]],
			["keep", ["b1"]],
		]);
	});

	it("applies today's planned ranges to last workout's sets that have none", () => {
		const suggestion = onlySuggestion(
			suggestForExercise(
				input({
					sets: [today("a", heavy), today("b", heavy)],
					previous: [last(100, 6), last(100, 6)],
				}),
			),
		);

		expect(suggestion.action).toBe("increase");
		expect(suggestion.repMin).toBe(4);
	});

	it("prefers the range last workout's sets were planned with", () => {
		const suggestion = onlySuggestion(
			suggestForExercise(
				input({
					sets: [today("a", backOff)],
					previous: [last(100, 6, heavy)],
				}),
			),
		);

		expect(suggestion).toMatchObject({ action: "increase", repMin: 4 });
	});

	it("suggests nothing without history", () => {
		expect(suggestForExercise(input({ sets: [today("a", heavy)] }))).toEqual(
			[],
		);
	});

	it("suggests nothing when last workout had only warm-ups", () => {
		expect(
			suggestForExercise(
				input({
					sets: [today("a", heavy)],
					previous: [last(60, 5, { warmup: true })],
				}),
			),
		).toEqual([]);
	});

	it("suggests nothing when today's sets plan no rep range (not from a template)", () => {
		expect(
			suggestForExercise(
				input({
					sets: [today("a"), today("w", { warmup: true, ...heavy })],
					previous: [last(100, 6, heavy)],
				}),
			),
		).toEqual([]);
	});

	it("suggests nothing for a measure without weight and reps", () => {
		expect(
			suggestForExercise(
				input({
					measure: "reps",
					sets: [today("a", heavy)],
					previous: [last(0, 6, heavy)],
				}),
			),
		).toEqual([]);
	});

	it("leaves out a group without a range or with a set missing its weight", () => {
		const found = suggestForExercise(
			input({
				sets: [today("a", heavy)],
				previous: [last(100, 5, heavy), last(80, 10)],
			}),
		);

		expect(found.map((s) => s.action)).toEqual(["addRep"]);
	});

	it("overwrites planned and typed values of not-done sets, but not sets already holding the suggestion", () => {
		const suggestion = onlySuggestion(
			suggestForExercise(
				input({
					sets: [
						today("planned", { ...heavy, weightKg: 100, reps: 4 }),
						today("typed", { ...heavy, weightKg: 105, reps: 5 }),
						today("holds", { ...heavy, weightKg: 102.5, reps: 4 }),
						today("empty", heavy),
					],
					previous: [
						last(100, 6, heavy),
						last(100, 6, heavy),
						last(100, 6, heavy),
						last(100, 6, heavy),
					],
				}),
			),
		);

		expect(suggestion.fills.map((f) => f.setId)).toEqual([
			"planned",
			"typed",
			"empty",
		]);
	});

	it("has nothing to fill once a pound set shows the suggested number", () => {
		const typedKg = 220.5 * KG_PER_LB;
		const suggestion = onlySuggestion(
			suggestForExercise(
				input({
					unit: "lb",
					sets: [today("a", { ...heavy, weightKg: typedKg, reps: 6 })],
					previous: [last(100, 5, heavy)],
				}),
			),
		);

		expect(suggestion.sets[0]).toEqual({ weightKg: 100, reps: 6 });
		expect(suggestion.fills).toEqual([]);
	});

	it("does not fill a set already done today, nor sets today does not have", () => {
		const suggestion = onlySuggestion(
			suggestForExercise(
				input({
					sets: [
						today("a", { ...heavy, completedAt: DONE, weightKg: 95, reps: 6 }),
						today("b", heavy),
					],
					previous: [
						last(100, 6, heavy),
						last(100, 6, heavy),
						last(100, 6, heavy),
					],
				}),
			),
		);

		expect(suggestion.sets).toHaveLength(3);
		expect(suggestion.fills.map((f) => f.setId)).toEqual(["b"]);
	});

	it("uses the dumbbell increment from the exercise's equipment", () => {
		const suggestion = onlySuggestion(
			suggestForExercise(
				input({
					exercise: { name: "Press", equipment: "dumbbell" },
					sets: [today("a", heavy)],
					previous: [last(20, 6, heavy)],
				}),
			),
		);

		expect(suggestion.sets).toEqual([{ weightKg: 22, reps: 4 }]);
	});

	it("rounds a raised weight to what loads in pounds", () => {
		const suggestion = onlySuggestion(
			suggestForExercise(
				input({
					unit: "lb",
					sets: [today("a", heavy)],
					previous: [last(100, 6, heavy)],
				}),
			),
		);

		expect(suggestion.sets[0]?.weightKg).toBeCloseTo(225 * KG_PER_LB, 9);
	});
});

describe("suggestForExercise lining groups up by rep range", () => {
	const fillsOf = (found: ExerciseSuggestion[]) =>
		found.map((s) => s.fills.map((f) => f.setId));

	it("A: a set-count change in one group does not shift the next group", () => {
		const found = suggestForExercise(
			input({
				sets: [
					today("h1", heavy),
					today("h2", heavy),
					today("h3", heavy),
					today("b1", backOff),
					today("b2", backOff),
				],
				previous: [
					last(100, 5, heavy),
					last(100, 5, heavy),
					last(60, 9, backOff),
					last(60, 9, backOff),
				],
			}),
		);

		expect(fillsOf(found)).toEqual([
			["h1", "h2"],
			["b1", "b2"],
		]);
		expect(found[1]?.fills[0]?.changes).toEqual({ weightKg: 60, reps: 10 });
	});

	it("B: a heavy set gained in the template never receives the back-off suggestion", () => {
		const found = suggestForExercise(
			input({
				sets: [today("h1", heavy), today("h2", heavy), today("h3", heavy)],
				previous: [
					last(100, 6, heavy),
					last(100, 6, heavy),
					last(60, 10, backOff),
				],
			}),
		);

		expect(found.map((s) => s.repMin)).toEqual([4, 8]);
		expect(fillsOf(found)).toEqual([["h1", "h2"], []]);
	});

	it("C: a skipped set does not give last time's light set the heavy range", () => {
		const found = suggestForExercise(
			input({
				sets: [today("h1", heavy), today("h2", heavy), today("b1", backOff)],
				previous: [last(100, 6), last(60, 6)],
			}),
		);

		expect(found).toEqual([]);
	});

	it("borrows today's ranges by position only when the set counts match", () => {
		const found = suggestForExercise(
			input({
				sets: [today("h1", heavy), today("b1", backOff)],
				previous: [last(100, 6), last(60, 8)],
			}),
		);

		expect(found.map((s) => [s.repMin, s.action])).toEqual([
			[4, "increase"],
			[8, "addRep"],
		]);
		expect(fillsOf(found)).toEqual([["h1"], ["b1"]]);
	});

	it("H: today's sets with another range than the suggestion are not filled", () => {
		const found = suggestForExercise(
			input({
				sets: [today("a", heavy), today("b", heavy)],
				previous: [last(60, 9, backOff), last(60, 9, backOff)],
			}),
		);

		expect(found).toHaveLength(1);
		expect(found[0]?.repMin).toBe(8);
		expect(found[0]?.fills).toEqual([]);
	});

	it("judges sets sharing a range together even when another range sits between them", () => {
		const found = suggestForExercise(
			input({
				sets: [today("h1", heavy), today("b1", backOff), today("h2", heavy)],
				previous: [
					last(100, 6, heavy),
					last(60, 9, backOff),
					last(100, 6, heavy),
				],
			}),
		);

		expect(fillsOf(found)).toEqual([["h1", "h2"], ["b1"]]);
	});
});

describe("findFirstOccurrenceIds", () => {
	it("keeps only the first card of an exercise that appears twice", () => {
		expect(
			findFirstOccurrenceIds([
				{ id: "we1", exerciseId: "bench" },
				{ id: "we2", exerciseId: "row" },
				{ id: "we3", exerciseId: "bench" },
			]),
		).toEqual(new Set(["we1", "we2"]));
	});
});

describe("describeSuggestion", () => {
	const base = { repMin: 4, repMax: 6, fills: [] };

	it("says the raised weight, with how many sets", () => {
		expect(
			describeSuggestion(
				{
					...base,
					action: "increase",
					sets: [
						{ weightKg: 72.5, reps: 4 },
						{ weightKg: 72.5, reps: 4 },
						{ weightKg: 72.5, reps: 4 },
					],
				},
				"kg",
			),
		).toBe("4–6 reps · Next: 72.5 kg × 4 (3 sets)");
	});

	it("asks for one more rep at the same weight", () => {
		expect(
			describeSuggestion(
				{
					...base,
					action: "addRep",
					sets: [
						{ weightKg: 70, reps: 6 },
						{ weightKg: 70, reps: 5 },
					],
				},
				"kg",
			),
		).toBe("4–6 reps · Same weight, aim for +1 rep: 70 kg × 6, 70 kg × 5");
	});

	it("repeats the weights and reps", () => {
		expect(
			describeSuggestion(
				{
					...base,
					repMin: 8,
					repMax: 8,
					action: "keep",
					sets: [{ weightKg: 100, reps: 7 }],
				},
				"kg",
			),
		).toBe("8 reps · Same weight and reps: 100 kg × 7");
	});

	it("shows weights in pounds", () => {
		expect(
			describeSuggestion(
				{
					...base,
					action: "increase",
					sets: [{ weightKg: 225 * KG_PER_LB, reps: 4 }],
				},
				"lb",
			),
		).toBe("4–6 reps · Next: 225 lb × 4");
	});
});
