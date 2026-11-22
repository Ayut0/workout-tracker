import { describe, expect, it } from "vitest";
import {
	getInstructionsCounter,
	getLinkLabel,
	isInstructionsDraftChanged,
	isSafeInstructionsLink,
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

describe("getLinkLabel", () => {
	it.each([
		["https://www.video.example.test/watch?v=abc", "video.example.test"],
		["http://example.test", "example.test"],
		["https://EXAMPLE.test:8443/a", "example.test"],
	])("shows %j as its host %j", (url, label) => {
		expect(getLinkLabel(url)).toBe(label);
	});

	it("falls back to the text itself when it cannot be read as a URL", () => {
		expect(getLinkLabel("not a url")).toBe("not a url");
	});
});

describe("isSafeInstructionsLink", () => {
	it.each(["https://example.test/a", "http://example.test"])(
		"renders %j as a link",
		(url) => {
			expect(isSafeInstructionsLink(url)).toBe(true);
		},
	);

	it.each([
		"javascript:alert(1)",
		"JavaScript:alert(1)",
		"data:text/html,<p>x</p>",
		"ftp://example.test/a",
		"example.test/a",
		"not a url",
		"",
	])("never renders %j as a link", (url) => {
		expect(isSafeInstructionsLink(url)).toBe(false);
	});
});
