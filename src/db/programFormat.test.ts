import { describe, expect, it } from "vitest";
import sample from "../../fixtures/program-sample.json?raw";
import {
	MAX_PROGRAM_ERRORS,
	PROGRAM_FORMAT,
	PROGRAM_FORMAT_VERSION,
	PROGRAM_LIMITS,
} from "./constants";
import { parseProgram } from "./programFormat";

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
function buildProgramWithExercise(exercise: Record<string, unknown>) {
	return makeProgram({
		blocks: [
			{
				block: 1,
				weeks: [{ week: 1, days: [{ day: "A", exercises: [exercise] }] }],
			},
		],
	});
}

function collectErrors(value: unknown): string[] {
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
		expect(collectErrors(makeProgram())).toEqual([]);
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
		expect(collectErrors(program)).toEqual([]);
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
			buildProgramWithExercise({ name: "Squat", sets: [{ rep_min: 5 }] }),
			new RegExp(
				`^${escapePath(EXERCISE_PATH)}\\.sets\\[0\\]\\.rep_min: unknown field`,
			),
		],
		[
			"an unknown measure",
			buildProgramWithExercise({ name: "Row", measure: "kg", sets: [{}] }),
			/exercises\[0\]\.measure: must be one of "weight-reps", "reps", "seconds", "distance"/,
		],
		[
			"a blank exercise name",
			buildProgramWithExercise({ name: "", sets: [{}] }),
			/exercises\[0\]\.name: must be a non-empty exercise name/,
		],
		[
			"an exercise with no sets",
			buildProgramWithExercise({ name: "Row", sets: [] }),
			/exercises\[0\]\.sets: must not be empty/,
		],
		[
			"a negative weight",
			buildProgramWithExercise({ name: "Row", sets: [{ weightKg: -5 }] }),
			/sets\[0\]\.weightKg: must be a number, 0 or more/,
		],
		[
			"fractional reps",
			buildProgramWithExercise({ name: "Row", sets: [{ reps: 7.5 }] }),
			/sets\[0\]\.reps: must be a whole number, 0 or more/,
		],
		[
			"a rep range with one end",
			buildProgramWithExercise({ name: "Row", sets: [{ repMin: 6 }] }),
			/sets\[0\]: repMin and repMax must be given together/,
		],
		[
			"a rep range with its ends swapped",
			buildProgramWithExercise({
				name: "Row",
				sets: [{ repMin: 10, repMax: 8 }],
			}),
			/sets\[0\]: repMin \(10\) must not be more than repMax \(8\)/,
		],
		[
			"a warm-up mark that is not a flag",
			buildProgramWithExercise({ name: "Row", sets: [{ warmup: "yes" }] }),
			/sets\[0\]\.warmup: must be true or false/,
		],
		[
			"a weight on a timed exercise",
			buildProgramWithExercise({
				name: "Plank",
				measure: "seconds",
				sets: [{ seconds: 30, weightKg: 10 }],
			}),
			/sets\[0\]\.weightKg: is not used by the measure "seconds" \(it uses seconds\)/,
		],
		[
			"a rep range on a distance exercise",
			buildProgramWithExercise({
				name: "Carry",
				measure: "distance",
				sets: [{ distanceM: 40, repMin: 1, repMax: 2 }],
			}),
			/sets\[0\]\.repMin: is not used by the measure "distance"/,
		],
	])("%s", (_name, value, expected) => {
		const errors = collectErrors(value);
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
		expect(collectErrors(program)).toEqual([
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
		expect(collectErrors(program)).toEqual([
			'blocks[0].weeks[0].days[1].day: "A" is used twice in this week (also blocks[0].weeks[0].days[0]).',
			"blocks[0].weeks[1].week: week 1 is used twice in this block (also blocks[0].weeks[0]).",
			"blocks[1].block: block 1 is used twice (also blocks[0]).",
		]);
	});

	it("an unknown measure once, without also judging its sets by a default", () => {
		expect(
			collectErrors(
				buildProgramWithExercise({
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
		const errors = collectErrors(
			buildProgramWithExercise({ name: "Row", sets }),
		);
		expect(errors).toHaveLength(MAX_PROGRAM_ERRORS + 1);
		expect(errors.at(-1)).toBe("…and 10 more problems.");
	});
});

describe("parseProgram leaves the library's measure to the import", () => {
	it("accepts a timed exercise that omits its measure", () => {
		expect(
			collectErrors(
				buildProgramWithExercise({ name: "Plank", sets: [{ seconds: 30 }] }),
			),
		).toEqual([]);
	});

	it("still rejects a set field the stated measure does not use", () => {
		expect(
			collectErrors(
				buildProgramWithExercise({
					name: "Plank",
					measure: "seconds",
					sets: [{ weightKg: 20 }],
				}),
			),
		).toHaveLength(1);
	});
});

describe("parseProgram rejects a set with reps and a rep range", () => {
	it("naming both", () => {
		expect(
			collectErrors(
				buildProgramWithExercise({
					name: "Row",
					sets: [{ reps: 3, repMin: 5, repMax: 8 }],
				}),
			),
		).toEqual([
			`${EXERCISE_PATH}.sets[0]: give either reps or a repMin and repMax range, not both.`,
		]);
	});
});

describe("parseProgram limits", () => {
	const day = { day: "A", exercises: [{ name: "Row", sets: [{}] }] };
	const L = PROGRAM_LIMITS;
	const repeat = <T>(count: number, item: T) =>
		Array.from({ length: count }, () => item);
	/** Distinct day ids, so only the count is wrong. */
	const buildDays = (count: number) =>
		Array.from({ length: count }, (_, i) => ({ ...day, day: `D${i}` }));
	const buildWeekList = (count: number, dayCount = 1) =>
		Array.from({ length: count }, (_, i) => ({
			week: i + 1,
			days: buildDays(dayCount),
		}));
	const buildBlockList = (count: number, weekCount = 1, dayCount = 1) =>
		Array.from({ length: count }, (_, i) => ({
			block: i + 1,
			weeks: buildWeekList(weekCount, dayCount),
		}));
	const buildProgramWithDays = (dayItems: unknown[]) =>
		makeProgram({
			blocks: [{ block: 1, weeks: [{ week: 1, days: dayItems }] }],
		});

	it.each([
		[
			"too many blocks",
			makeProgram({ blocks: buildBlockList(L.maxBlocks + 1) }),
			/^blocks: has \d+ items; at most \d+ are allowed/,
		],
		[
			"too many weeks in a block",
			makeProgram({ blocks: buildBlockList(1, L.maxWeeksPerBlock + 1) }),
			/blocks\[0\]\.weeks: has \d+ items; at most \d+ are allowed/,
		],
		[
			"too many days in a week",
			buildProgramWithDays(buildDays(L.maxDaysPerWeek + 1)),
			/days: has \d+ items; at most \d+ are allowed/,
		],
		[
			"too many exercises in a day",
			buildProgramWithDays([
				{
					day: "A",
					exercises: repeat(L.maxExercisesPerDay + 1, {
						name: "Row",
						sets: [{}],
					}),
				},
			]),
			/exercises: has \d+ items; at most \d+ are allowed/,
		],
		[
			"too many sets",
			buildProgramWithExercise({
				name: "Row",
				sets: repeat(L.maxSetsPerExercise + 1, {}),
			}),
			/sets: has \d+ items; at most \d+ are allowed/,
		],
		[
			"too many templates in all",
			makeProgram({
				blocks: buildBlockList(
					L.maxBlocks,
					L.maxWeeksPerBlock,
					L.maxDaysPerWeek,
				),
			}),
			/^blocks: would create \d+ templates .*at most \d+ are allowed/,
		],
		[
			"a very long program name",
			makeProgram({ name: "x".repeat(L.maxNameLength + 1) }),
			/^name: must be at most \d+ characters/,
		],
		[
			"a very long programId",
			makeProgram({ programId: "x".repeat(L.maxIdLength + 1) }),
			/^programId: must be at most \d+ characters/,
		],
		[
			"a very long exercise name",
			buildProgramWithExercise({
				name: "x".repeat(L.maxNameLength + 1),
				sets: [{}],
			}),
			/exercises\[0\]\.name: must be at most \d+ characters/,
		],
		[
			"very long notes",
			buildProgramWithExercise({
				name: "Row",
				notes: "x".repeat(L.maxNotesLength + 1),
				sets: [{}],
			}),
			/exercises\[0\]\.notes: must be at most \d+ characters/,
		],
		[
			"a very long day id",
			buildProgramWithDays([{ ...day, day: "x".repeat(L.maxIdLength + 1) }]),
			/days\[0\]\.day: must be at most \d+ characters/,
		],
		[
			"a very long day name",
			buildProgramWithDays([{ ...day, name: "x".repeat(L.maxNameLength + 1) }]),
			/days\[0\]\.name: must be at most \d+ characters/,
		],
		[
			"huge reps",
			buildProgramWithExercise({ name: "Row", sets: [{ reps: 1e300 }] }),
			/sets\[0\]\.reps: must be at most 999/,
		],
		[
			"a huge weight",
			buildProgramWithExercise({ name: "Row", sets: [{ weightKg: 1e308 }] }),
			/sets\[0\]\.weightKg: must be at most \d+/,
		],
		[
			"a huge time",
			buildProgramWithExercise({
				name: "Plank",
				measure: "seconds",
				sets: [{ seconds: 1e9 }],
			}),
			/sets\[0\]\.seconds: must be at most \d+/,
		],
		[
			"a huge distance",
			buildProgramWithExercise({
				name: "Run",
				measure: "distance",
				sets: [{ distanceM: 1e9 }],
			}),
			/sets\[0\]\.distanceM: must be at most \d+/,
		],
		[
			"a huge targetRir",
			buildProgramWithExercise({ name: "Row", sets: [{ targetRir: 1e20 }] }),
			/sets\[0\]\.targetRir: must be at most \d+/,
		],
		[
			"a huge rep range",
			buildProgramWithExercise({
				name: "Row",
				sets: [{ repMin: 1, repMax: 1e6 }],
			}),
			/sets\[0\]\.repMax: must be at most 999/,
		],
		[
			"a huge block number",
			makeProgram({ blocks: [{ ...buildBlockList(1)[0], block: 1e300 }] }),
			/blocks\[0\]\.block: must be at most \d+/,
		],
		[
			"an unsafe week number",
			makeProgram({
				blocks: [
					{
						block: 1,
						weeks: [{ week: Number.MAX_SAFE_INTEGER + 2, days: buildDays(1) }],
					},
				],
			}),
			/weeks\[0\]\.week: must be at most \d+/,
		],
		[
			"a name of only zero-width characters",
			buildProgramWithExercise({ name: "​‍﻿", sets: [{}] }),
			/exercises\[0\]\.name: must be a non-empty exercise name/,
		],
		[
			"a programId of only zero-width characters",
			makeProgram({ programId: "​" }),
			/^programId: must be a non-empty id/,
		],
		[
			"a day id that differs only in inner spacing",
			buildProgramWithDays([
				{ ...day, day: "A  B" },
				{ ...day, day: "A B" },
			]),
			/days\[1\]\.day: "A B" is used twice in this week/,
		],
	])("%s", (_name, value, expected) => {
		const errors = collectErrors(value);
		expect(errors.some((error) => expected.test(error))).toBe(true);
	});

	it("accepts values at the limits", () => {
		expect(
			collectErrors(
				buildProgramWithExercise({
					name: "x".repeat(L.maxNameLength),
					sets: [
						{
							weightKg: L.maxWeightKg,
							reps: L.maxReps,
							targetRir: L.maxTargetRir,
						},
					],
				}),
			),
		).toEqual([]);
	});

	it("does not walk a list that is over its limit", () => {
		const errors = collectErrors(
			makeProgram({ blocks: buildBlockList(L.maxBlocks + 1) }),
		);
		expect(errors).toHaveLength(1);
	});

	it("refuses text over the file size limit", () => {
		expect(collectErrors(" ".repeat(L.maxFileBytes + 1))).toEqual([
			expect.stringMatching(/^The file is larger than 2 MB/),
		]);
	});
});

/** Escapes a path for use in a RegExp. */
function escapePath(text: string): string {
	return text.replace(/[.[\]]/g, "\\$&");
}
