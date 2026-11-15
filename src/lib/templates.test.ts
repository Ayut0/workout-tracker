import { describe, expect, it } from "vitest";
import type { TemplateExercise } from "../db/types";
import {
	appendPlannedSet,
	appendTemplateExercise,
	countPlannedSets,
	describeTemplateFromWorkout,
	moveTemplateExercise,
	removePlannedSet,
	removeTemplateExercise,
	setTemplateExerciseNotes,
	updatePlannedSet,
} from "./templates";

const DRAFT: readonly TemplateExercise[] = Object.freeze([
	{ exerciseId: "bench", sets: [{ weightKg: 60, reps: 8 }, { reps: 6 }] },
	{ exerciseId: "squat", sets: [] },
	{ exerciseId: "row", sets: [{}] },
]);

describe("template draft edits", () => {
	it("appends an exercise with one empty set", () => {
		expect(appendTemplateExercise(DRAFT, "curl").at(-1)).toEqual({
			exerciseId: "curl",
			sets: [{}],
		});
		expect(DRAFT).toHaveLength(3);
	});

	it("removes an exercise", () => {
		expect(removeTemplateExercise(DRAFT, 1).map((e) => e.exerciseId)).toEqual([
			"bench",
			"row",
		]);
	});

	it("moves an exercise, clamped to the ends", () => {
		expect(moveTemplateExercise(DRAFT, 0, 1).map((e) => e.exerciseId)).toEqual([
			"squat",
			"bench",
			"row",
		]);
		expect(moveTemplateExercise(DRAFT, 2, -5).map((e) => e.exerciseId)).toEqual(
			["row", "bench", "squat"],
		);
	});

	it("appends a set copying the weight and reps of the last one", () => {
		const first = appendPlannedSet(DRAFT, 0, "weight-reps")[0];
		expect(first?.sets).toEqual([
			{ weightKg: 60, reps: 8 },
			{ reps: 6 },
			{ reps: 6 },
		]);
		expect(appendPlannedSet(DRAFT, 1, "weight-reps")[1]?.sets).toEqual([{}]);
		expect(DRAFT[0]?.sets).toHaveLength(2);
	});

	it("removes a set", () => {
		expect(removePlannedSet(DRAFT, 0, 0)[0]?.sets).toEqual([{ reps: 6 }]);
	});

	it("updates and clears a set's weight and reps", () => {
		const updated = updatePlannedSet(DRAFT, 0, 1, { weightKg: 50 });
		expect(updated[0]?.sets[1]).toEqual({ weightKg: 50, reps: 6 });

		const cleared = updatePlannedSet(DRAFT, 0, 0, { reps: undefined });
		expect(cleared[0]?.sets[0]).toEqual({ weightKg: 60 });
		expect(DRAFT[0]?.sets[0]).toEqual({ weightKg: 60, reps: 8 });
	});

	it("updates and clears a set's seconds and distance", () => {
		const timed = updatePlannedSet(DRAFT, 2, 0, { seconds: 60 });
		expect(timed[2]?.sets[0]).toEqual({ seconds: 60 });

		const carried = updatePlannedSet(timed, 2, 0, {
			seconds: undefined,
			distanceM: 40,
		});
		expect(carried[2]?.sets[0]).toEqual({ distanceM: 40 });
	});

	it("starts an added set with the seconds or distance of the one before", () => {
		const timed = updatePlannedSet(DRAFT, 2, 0, { seconds: 45 });
		expect(appendPlannedSet(timed, 2, "seconds")[2]?.sets).toEqual([
			{ seconds: 45 },
			{ seconds: 45 },
		]);
	});

	it("does not carry values the measure hides into an added set", () => {
		expect(appendPlannedSet(DRAFT, 0, "reps")[0]?.sets.at(-1)).toEqual({
			reps: 6,
		});
	});

	it("marks a planned set as a warm-up and clears the mark (#65)", () => {
		const marked = updatePlannedSet(DRAFT, 0, 0, { warmup: true });
		expect(marked[0]?.sets[0]).toEqual({ weightKg: 60, reps: 8, warmup: true });

		const cleared = updatePlannedSet(marked, 0, 0, { warmup: undefined });
		expect(cleared[0]?.sets[0]).toEqual({ weightKg: 60, reps: 8 });
	});

	it("does not make a set added after a warm-up a warm-up (#65)", () => {
		const marked = updatePlannedSet(DRAFT, 0, 1, { warmup: true });
		expect(appendPlannedSet(marked, 0, "weight-reps")[0]?.sets.at(-1)).toEqual({
			reps: 6,
		});
	});

	it("counts planned sets", () => {
		expect(countPlannedSets(DRAFT)).toBe(3);
	});
});

describe("describeTemplateFromWorkout", () => {
	it("names the saved template, or says why nothing was saved", () => {
		expect(
			describeTemplateFromWorkout({
				ok: true,
				template: { id: "t", name: "Push", exercises: [] },
			}),
		).toBe("Saved template “Push”.");
		expect(
			describeTemplateFromWorkout({ ok: false, reason: "no-complete-sets" }),
		).toMatch(/no set was marked done/);
		expect(
			describeTemplateFromWorkout({ ok: false, reason: "not-found" }),
		).toMatch(/no longer exists/);
	});
});

describe("template exercise notes (ADR-0014)", () => {
	it("sets, keeps as typed and clears an exercise's notes", () => {
		const noted = setTemplateExerciseNotes(DRAFT, 0, "seat 4 ");
		expect(noted[0]).toEqual({ ...DRAFT[0], notes: "seat 4 " });
		expect(noted[1]).toBe(DRAFT[1]);

		const cleared = setTemplateExerciseNotes(noted, 0, "  ");
		expect(cleared[0]).toEqual(DRAFT[0]);
		expect(Object.hasOwn(cleared[0] ?? {}, "notes")).toBe(false);
	});

	it("are kept when the exercise's sets are edited", () => {
		const noted = setTemplateExerciseNotes(DRAFT, 0, "seat 4");
		const edited = updatePlannedSet(
			appendPlannedSet(removePlannedSet(noted, 0, 1), 0, "weight-reps"),
			0,
			0,
			{ reps: 10 },
		);
		expect(edited[0]?.notes).toBe("seat 4");
	});
});

describe("planned rep range and target RIR (ADR-0014)", () => {
	it("are set and cleared on a planned set", () => {
		const planned = updatePlannedSet(DRAFT, 0, 0, {
			repMin: 6,
			repMax: 8,
			targetRir: 2,
		});
		expect(planned[0]?.sets[0]).toEqual({
			weightKg: 60,
			reps: 8,
			repMin: 6,
			repMax: 8,
			targetRir: 2,
		});

		const cleared = updatePlannedSet(planned, 0, 0, {
			repMin: undefined,
			repMax: undefined,
			targetRir: undefined,
		});
		expect(cleared[0]?.sets[0]).toEqual({ weightKg: 60, reps: 8 });
	});

	it("start an added set with the targets of the one before", () => {
		const planned = updatePlannedSet(DRAFT, 0, 1, { repMin: 6, repMax: 8 });
		expect(appendPlannedSet(planned, 0, "weight-reps")[0]?.sets.at(-1)).toEqual(
			{ reps: 6, repMin: 6, repMax: 8 },
		);
	});
});
