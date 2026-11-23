import { describe, expect, it } from "vitest";
import {
	getInstructionsCounter,
	isInstructionsDraftChanged,
} from "./instructions";

describe("getInstructionsCounter", () => {
	it("is hidden while the text is well under the cap", () => {
		expect(getInstructionsCounter("x".repeat(1799))).toBeUndefined();
	});

	it("shows the count against the cap once the text nears it", () => {
		expect(getInstructionsCounter("x".repeat(1800))).toBe("1,800 / 2,000");
	});

	it("counts what would be saved, not the blank ends", () => {
		expect(getInstructionsCounter(`  ${"x".repeat(1799)}\n\n`)).toBeUndefined();
	});

	it("keeps showing the count past the cap", () => {
		expect(getInstructionsCounter("x".repeat(2001))).toBe("2,001 / 2,000");
	});
});

describe("isInstructionsDraftChanged", () => {
	const stored = {
		instructions: "Lorem ipsum.\nDolor sit.",
		instructionsUrl: "https://example.test/lorem",
	};

	it("is unchanged when the draft matches once trimmed", () => {
		expect(
			isInstructionsDraftChanged(
				{
					text: " Lorem ipsum.\nDolor sit.\n",
					url: "https://example.test/lorem ",
				},
				stored,
			),
		).toBe(false);
	});

	it("treats a blank draft as matching nothing stored", () => {
		expect(isInstructionsDraftChanged({ text: " ", url: "" }, {})).toBe(false);
	});

	it.each([
		[{ text: "Lorem ipsum.\nAmet.", url: "https://example.test/lorem" }],
		[{ text: "Lorem ipsum.\nDolor sit.", url: "" }],
		[{ text: "", url: "https://example.test/lorem" }],
	])("is changed for %j", (draft) => {
		expect(isInstructionsDraftChanged(draft, stored)).toBe(true);
	});
});
