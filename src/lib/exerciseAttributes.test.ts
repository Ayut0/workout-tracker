import { describe, expect, it } from "vitest";
import {
	isEquipment,
	isExerciseCategory,
	isMovementPattern,
	toggleMuscle,
	toggleMuscleRole,
} from "./exerciseAttributes";

describe("toggleMuscle", () => {
	it("adds a muscle in vocabulary order", () => {
		expect(toggleMuscle(["quads"], "glutes")).toEqual(["glutes", "quads"]);
		expect(toggleMuscle(undefined, "chest")).toEqual(["chest"]);
	});

	it("removes a muscle that is already there", () => {
		expect(toggleMuscle(["glutes", "quads"], "glutes")).toEqual(["quads"]);
	});
});

describe("toggleMuscleRole", () => {
	it("adds a muscle to a role and keeps the other attributes", () => {
		expect(
			toggleMuscleRole({ equipment: "barbell" }, "primary", "quads"),
		).toEqual({
			equipment: "barbell",
			primaryMuscles: ["quads"],
			secondaryMuscles: [],
		});
	});

	it("moves a muscle from one role to the other", () => {
		const squat = {
			primaryMuscles: ["quads" as const],
			secondaryMuscles: ["glutes" as const],
		};
		expect(toggleMuscleRole(squat, "primary", "glutes")).toEqual({
			primaryMuscles: ["glutes", "quads"],
			secondaryMuscles: [],
		});
		expect(toggleMuscleRole(squat, "secondary", "quads")).toEqual({
			primaryMuscles: [],
			secondaryMuscles: ["glutes", "quads"],
		});
	});

	it("removes a muscle from its role", () => {
		expect(
			toggleMuscleRole({ secondaryMuscles: ["abs"] }, "secondary", "abs"),
		).toEqual({ primaryMuscles: [], secondaryMuscles: [] });
	});
});

describe("attribute guards", () => {
	it("accept only the vocabulary", () => {
		expect(isMovementPattern("hinge")).toBe(true);
		expect(isMovementPattern("push")).toBe(false);
		expect(isExerciseCategory("mobility")).toBe(true);
		expect(isExerciseCategory("")).toBe(false);
		expect(isEquipment("cable")).toBe(true);
		expect(isEquipment("kettlebell")).toBe(false);
	});
});
