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
		const first = appendPlannedSet(DRAFT, 0)[0];
		expect(first?.sets).toEqual([
			{ weightKg: 60, reps: 8 },
			{ reps: 6 },
			{ reps: 6 },
		]);
		expect(appendPlannedSet(DRAFT, 1)[1]?.sets).toEqual([{}]);
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
