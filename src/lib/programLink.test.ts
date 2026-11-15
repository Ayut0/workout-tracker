import { describe, expect, it } from "vitest";
import { describeProgramLink } from "./programLink";

const LINK = { programId: "p", programName: "Block", block: 1, week: 2 };

describe("describeProgramLink", () => {
	it("names the week and block", () => {
		expect(describeProgramLink(LINK)).toBe("Week 2 · Block 1");
	});

	it("marks a deload week", () => {
		expect(describeProgramLink({ ...LINK, week: 4, deload: true })).toBe(
			"Week 4 · Block 1 · Deload",
		);
	});
});
