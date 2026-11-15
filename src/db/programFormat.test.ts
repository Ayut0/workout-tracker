import { describe, expect, it } from "vitest";
import sample from "../../fixtures/program-sample.json?raw";
import {
	MAX_PROGRAM_ERRORS,
	PROGRAM_FORMAT,
	PROGRAM_FORMAT_VERSION,
	parseProgram,
} from "./programFormat";

/** A valid one-day program; `changes` replace top-level fields. */
function makeProgram(changes: Record<string, unknown> = {}) {
	return {
		format: PROGRAM_FORMAT,
		formatVersion: PROGRAM_FORMAT_VERSION,
		programId: "p",
		name: "Program",
		blocks: [
			{
				block: 1,
				weeks: [
					{
						week: 1,
						days: [
							{
								day: "A",
								exercises: [
									{
										name: "Squat",
										sets: [{ weightKg: 50, repMin: 5, repMax: 8 }],
									},
								],
							},
						],
					},
				],
			},
		],
		...changes,
	};
}

/** A valid program whose only exercise is `exercise`. */
function withExercise(exercise: Record<string, unknown>) {
	return makeProgram({
		blocks: [
			{
				block: 1,
				weeks: [{ week: 1, days: [{ day: "A", exercises: [exercise] }] }],
			},
		],
	});
}

function errorsOf(value: unknown): string[] {
	const parsed = parseProgram(
		typeof value === "string" ? value : JSON.stringify(value),
	);
	return parsed.ok ? [] : parsed.errors;
}

const EXERCISE_PATH = "blocks[0].weeks[0].days[0].exercises[0]";

describe("parseProgram accepts", () => {
	it("the example program in fixtures/", () => {
		const parsed = parseProgram(sample);
		if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
		expect(parsed.program.blocks[0]?.weeks).toHaveLength(4);
		expect(parsed.program.blocks[0]?.weeks[3]?.deload).toBe(true);
	});

	it("a minimal program", () => {
		expect(errorsOf(makeProgram())).toEqual([]);
	});

	it("a measure given on a later mention of the exercise", () => {
		const program = makeProgram({
			blocks: [
				{
					block: 1,
					weeks: [
						{
							week: 1,
							days: [
								{
									day: "A",
									exercises: [{ name: "Plank", sets: [{ seconds: 30 }] }],
								},
								{
									day: "B",
									exercises: [
										{
											name: " plank ",
											measure: "seconds",
											sets: [{ seconds: 40 }],
										},
									],
								},
							],
						},
					],
				},
			],
		});
		expect(errorsOf(program)).toEqual([]);
	});
});

describe("parseProgram rejects", () => {
	it.each([
		["text that is not JSON", "{ nope", /^The file is not valid JSON/],
		["a list", "[]", /must hold one JSON object/],
		[
			"another format",
			makeProgram({ format: "x" }),
			/^format: must be "workout-tracker-program"/,
		],
		[
			"a newer format version",
			makeProgram({ formatVersion: PROGRAM_FORMAT_VERSION + 1 }),
			/^formatVersion: 2 is newer than this app reads \(1\)/,
		],
		[
			"a blank programId",
			makeProgram({ programId: " " }),
			/^programId: must be a non-empty id/,
		],
		["no blocks", makeProgram({ blocks: [] }), /^blocks: must not be empty/],
		[
			"an unknown top-level field",
			makeProgram({ weeks: 4 }),
			/^weeks: unknown field\. Allowed here: format, formatVersion/,
		],
		[
			"a set field with a typo",
			withExercise({ name: "Squat", sets: [{ rep_min: 5 }] }),
			new RegExp(
				`^${escapePath(EXERCISE_PATH)}\\.sets\\[0\\]\\.rep_min: unknown field`,
			),
		],
		[
			"an unknown measure",
			withExercise({ name: "Row", measure: "kg", sets: [{}] }),
			/exercises\[0\]\.measure: must be one of "weight-reps", "reps", "seconds", "distance"/,
		],
		[
			"a blank exercise name",
			withExercise({ name: "", sets: [{}] }),
			/exercises\[0\]\.name: must be a non-empty exercise name/,
		],
		[
			"an exercise with no sets",
			withExercise({ name: "Row", sets: [] }),
			/exercises\[0\]\.sets: must not be empty/,
		],
		[
			"a negative weight",
			withExercise({ name: "Row", sets: [{ weightKg: -5 }] }),
			/sets\[0\]\.weightKg: must be a number, 0 or more/,
		],
		[
			"fractional reps",
			withExercise({ name: "Row", sets: [{ reps: 7.5 }] }),
			/sets\[0\]\.reps: must be a whole number, 0 or more/,
		],
		[
			"a rep range with one end",
			withExercise({ name: "Row", sets: [{ repMin: 6 }] }),
			/sets\[0\]: repMin and repMax must be given together/,
		],
		[
			"a rep range with its ends swapped",
			withExercise({ name: "Row", sets: [{ repMin: 10, repMax: 8 }] }),
			/sets\[0\]: repMin \(10\) must not be more than repMax \(8\)/,
		],
		[
			"a warm-up mark that is not a flag",
			withExercise({ name: "Row", sets: [{ warmup: "yes" }] }),
			/sets\[0\]\.warmup: must be true or false/,
		],
		[
			"a weight on a timed exercise",
			withExercise({
				name: "Plank",
				measure: "seconds",
				sets: [{ seconds: 30, weightKg: 10 }],
			}),
			/sets\[0\]\.weightKg: is not used by the measure "seconds" \(it uses seconds\)/,
		],
		[
			"a rep range on a distance exercise",
			withExercise({
				name: "Carry",
				measure: "distance",
				sets: [{ distanceM: 40, repMin: 1, repMax: 2 }],
			}),
			/sets\[0\]\.repMin: is not used by the measure "distance"/,
		],
	])("%s", (_name, value, expected) => {
		const errors = errorsOf(value);
		expect(errors.some((error) => expected.test(error))).toBe(true);
	});

	it("the same exercise with two measures, naming where the first was", () => {
		const program = makeProgram({
			blocks: [
				{
					block: 1,
					weeks: [
						{
							week: 1,
							days: [
								{
									day: "A",
									exercises: [
										{ name: "Plank", measure: "seconds", sets: [{}] },
									],
								},
								{
									day: "B",
									exercises: [{ name: "PLANK", measure: "reps", sets: [{}] }],
								},
							],
						},
					],
				},
			],
		});
		expect(errorsOf(program)).toEqual([
			'blocks[0].weeks[0].days[1].exercises[0].measure: "reps" differs from "seconds" given for "PLANK" at blocks[0].weeks[0].days[0].exercises[0].measure; an exercise has one measure.',
		]);
	});

	it("repeated block, week and day numbers", () => {
		const day = { day: "A", exercises: [{ name: "Row", sets: [{}] }] };
		const program = makeProgram({
			blocks: [
				{
					block: 1,
					weeks: [
						{ week: 1, days: [day, day] },
						{ week: 1, days: [day] },
					],
				},
				{ block: 1, weeks: [{ week: 1, days: [day] }] },
			],
		});
		expect(errorsOf(program)).toEqual([
			'blocks[0].weeks[0].days[1].day: "A" is used twice in this week (also blocks[0].weeks[0].days[0]).',
			"blocks[0].weeks[1].week: week 1 is used twice in this block (also blocks[0].weeks[0]).",
			"blocks[1].block: block 1 is used twice (also blocks[0]).",
		]);
	});

	it("an unknown measure once, without also judging its sets by a default", () => {
		expect(
			errorsOf(
				withExercise({
					name: "Plank",
					measure: "time",
					sets: [{ seconds: 30 }],
				}),
			),
		).toEqual([
			`${EXERCISE_PATH}.measure: must be one of "weight-reps", "reps", "seconds", "distance".`,
		]);
	});

	it("listing every problem, up to a limit", () => {
		const sets = Array.from({ length: 30 }, () => ({ reps: -1 }));
		const errors = errorsOf(withExercise({ name: "Row", sets }));
		expect(errors).toHaveLength(MAX_PROGRAM_ERRORS + 1);
		expect(errors.at(-1)).toBe("…and 10 more problems.");
	});
});

/** Escapes a path for use in a RegExp. */
function escapePath(text: string): string {
	return text.replace(/[.[\]]/g, "\\$&");
}
