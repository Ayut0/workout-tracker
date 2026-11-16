import { describe, expect, it } from "vitest";
import { describeProgramLink } from "./programLink";

const LINK = { programId: "p", programName: "Block", block: 1, week: 2 };

describe("describeProgramLink", () => {
	it("names the week and block", () => {
		expect(describeProgramLink(LINK)).toBe("Week 2 · Block 1");
	});

	it("adds the day after the week and block", () => {
		expect(describeProgramLink({ ...LINK, day: "A" })).toBe(
			"Week 2 · Block 1 · Day A",
		);
		expect(describeProgramLink({ ...LINK, day: "B" })).not.toBe(
			describeProgramLink({ ...LINK, day: "A" }),
		);
	});

	it("leaves out an empty day and the program name", () => {
		expect(describeProgramLink({ ...LINK, day: "" })).toBe("Week 2 · Block 1");
		expect(
			describeProgramLink({ ...LINK, programName: "Powerbuilding" }),
		).not.toContain("Powerbuilding");
	});

	it("puts the deload mark last", () => {
		expect(
			describeProgramLink({ ...LINK, week: 4, day: "A", deload: true }),
		).toBe("Week 4 · Block 1 · Day A · Deload");
	});

	it("marks a deload week", () => {
		expect(describeProgramLink({ ...LINK, week: 4, deload: true })).toBe(
			"Week 4 · Block 1 · Deload",
		);
	});
});
