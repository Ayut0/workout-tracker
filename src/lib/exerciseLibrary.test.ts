import { describe, expect, it } from "vitest";
import type { Exercise } from "../db/types";
import {
	describeExerciseNameError,
	filterExercisesByName,
} from "./exerciseLibrary";

const exercise = (id: string, name: string, nameKey: string): Exercise => ({
	id,
	name,
	nameKey,
});

const bench = exercise("b", "Bench Press (Barbell)", "bench press (barbell)");
const incline = exercise("i", "Incline Bench Press", "incline bench press");
const squat = exercise("s", "Squat", "squat");
const library = [bench, incline, squat];

describe("filterExercisesByName", () => {
	it("returns every exercise for a blank query", () => {
		expect(filterExercisesByName(library, "  ")).toEqual(library);
	});

	it("matches part of a name ignoring case and spacing", () => {
		const ids = filterExercisesByName(library, "  BENCH   press ").map(
			(e) => e.id,
		);
		expect(ids).toEqual(["b", "i"]);
	});

	it("returns nothing when no name matches", () => {
		expect(filterExercisesByName(library, "deadlift")).toEqual([]);
	});
});

describe("describeExerciseNameError", () => {
	it("asks for a name when it is blank", () => {
		expect(describeExerciseNameError({ ok: false, reason: "empty" })).toBe(
			"Enter a name.",
		);
	});

	it("names the exercise that already holds the name", () => {
		expect(
			describeExerciseNameError({
				ok: false,
				reason: "duplicate",
				existing: squat,
			}),
		).toBe("“Squat” is already in your library.");
	});

	it("points to restoring when the name belongs to an archived exercise", () => {
		expect(
			describeExerciseNameError({
				ok: false,
				reason: "duplicate",
				existing: { ...exercise("r", "Row", "row"), archivedAt: 1 },
			}),
		).toBe("“Row” is archived. Restore it instead.");
	});

	it("explains an exercise that was removed meanwhile", () => {
		expect(describeExerciseNameError({ ok: false, reason: "not-found" })).toBe(
			"That exercise no longer exists.",
		);
	});
});
