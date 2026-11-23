import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import block1 from "../../programs/block-1.json?raw";
import { WorkoutDB } from "./index";
import { parseProgram } from "./programFormat";
import { previewProgramImport } from "./programImport";
import type { ProgramExercise, ProgramFile, ProgramWeek } from "./types";

/**
 * Guards `programs/block-1.json` (#68): the file the owner imports for the
 * first training block. It must pass the app's own validator, hold no
 * personal loads, and keep its deload week in step with the progression rule.
 */

let database: WorkoutDB;

beforeEach(async () => {
	database = new WorkoutDB(`test-${crypto.randomUUID()}`);
	await database.open();
});

afterEach(async () => {
	await database.delete();
});

function readBlock1(): ProgramFile {
	const parsed = parseProgram(block1);
	if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
	return parsed.program;
}

function getWeek(program: ProgramFile, number: number): ProgramWeek {
	const week = program.blocks[0]?.weeks.find((w) => w.week === number);
	if (!week) throw new Error(`week ${number} is missing`);
	return week;
}

function countWorkingSets(exercise: ProgramExercise): number {
	return exercise.sets.filter((set) => set.warmup !== true).length;
}

describe("programs/block-1.json", () => {
	it("passes the program validator", () => {
		expect(parseProgram(block1).ok).toBe(true);
	});

	it("is one block of four weeks with days A to E, the last week a deload", () => {
		const program = readBlock1();
		expect(program.programId).toBe("hybrid-2026");
		expect(program.blocks).toHaveLength(1);
		const weeks = program.blocks[0]?.weeks ?? [];
		expect(weeks.map((w) => w.week)).toEqual([1, 2, 3, 4]);
		expect(weeks.map((w) => w.deload === true)).toEqual([
			false,
			false,
			false,
			true,
		]);
		for (const week of weeks) {
			expect(week.days.map((d) => d.day)).toEqual(["A", "B", "C", "D", "E"]);
		}
	});

	it("holds no weights: the owner's loads stay private", () => {
		expect(block1).not.toContain("weightKg");
	});

	it("imports into an empty library as 20 templates with no set errors", async () => {
		const plan = await previewProgramImport(readBlock1(), database);
		expect(plan.setErrors).toEqual([]);
		expect(plan.templates).toHaveLength(20);
		const names = plan.newExercises.map((e) => e.name);
		expect(names).toContain("Easy Cardio");
		expect(names).not.toContain("Sprint");
		expect(names).not.toContain("5-10-5 Shuttle");
	});

	it("deloads to about two thirds of each exercise's working sets, like Progression", () => {
		const program = readBlock1();
		const lastHard = getWeek(program, 3);
		const deload = getWeek(program, 4);
		const keptShare = (count: number) =>
			Math.max(1, Math.round((count * 2) / 3));
		// Mobility, prep, cardio and Bench Press (its back-off sets go) are
		// checked separately below.
		const unchanged = new Set([
			"90/90 Hip Switch",
			"World's Greatest Stretch",
			"Ankle Rocks",
			"Goblet Squat Hold",
			"Thoracic Rotation",
			"Wall Slide",
			"Dead Hang",
			"Doorway Chest Stretch",
			"Bench Lat Stretch",
			"Couch Stretch",
			"90/90 Hip Hold",
			"Adductor Rockback",
			"Hamstring Stretch",
			"Knee-to-Wall Ankle Stretch",
			"Bench Thoracic Extension",
			"Easy Cardio",
		]);
		for (const day of deload.days) {
			const hardDay = lastHard.days.find((d) => d.day === day.day);
			for (const exercise of day.exercises) {
				const hard = hardDay?.exercises.find((e) => e.name === exercise.name);
				if (hard === undefined) continue; // the alternating row
				const kept = countWorkingSets(exercise);
				if (unchanged.has(exercise.name)) {
					expect(kept, exercise.name).toBe(countWorkingSets(hard));
				} else if (exercise.name === "Bench Press (Barbell)") {
					expect(kept).toBe(3);
				} else {
					expect(kept, exercise.name).toBe(keptShare(countWorkingSets(hard)));
				}
			}
		}
	});

	it("alternates Day D's row: Lat Pulldown in weeks 1 and 3, Single Arm Row in 2 and 4", () => {
		const program = readBlock1();
		const rowOf = (weekNumber: number) =>
			getWeek(program, weekNumber)
				.days.find((d) => d.day === "D")
				?.exercises.map((e) => e.name)
				.filter(
					(name) =>
						name === "Lat Pulldown (Cable)" ||
						name === "Single Arm Row (Dumbbell)",
				);
		expect(rowOf(1)).toEqual(["Lat Pulldown (Cable)"]);
		expect(rowOf(2)).toEqual(["Single Arm Row (Dumbbell)"]);
		expect(rowOf(3)).toEqual(["Lat Pulldown (Cable)"]);
		expect(rowOf(4)).toEqual(["Single Arm Row (Dumbbell)"]);
	});
});
