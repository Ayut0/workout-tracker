import { describe, expect, it } from "vitest";
import { ExerciseNotes } from "./ExerciseNotes";

describe("ExerciseNotes", () => {
	it("renders nothing for missing or blank notes", () => {
		for (const notes of [undefined, "", "  ", "\n"]) {
			expect(ExerciseNotes({ notes })).toBeNull();
		}
	});

	it("renders notes that have text", () => {
		expect(ExerciseNotes({ notes: "seat 4" })).not.toBeNull();
	});
});
