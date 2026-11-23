import { describe, expect, it } from "vitest";
import {
	checkInstructionsUrl,
	MAX_INSTRUCTIONS_LENGTH,
	MAX_INSTRUCTIONS_URL_LENGTH,
	prepareInstructions,
	tidyInstructions,
} from "./instructions";

describe("tidyInstructions", () => {
	it("trims the ends and keeps the line breaks inside", () => {
		expect(tidyInstructions("  Step one.\n\nStep two.\n ")).toBe(
			"Step one.\n\nStep two.",
		);
	});

	it.each(["", "   ", "\n\t "])("stores %j as nothing", (text) => {
		expect(tidyInstructions(text)).toBeUndefined();
	});
});

describe("checkInstructionsUrl", () => {
	it.each([
		"https://example.test/how-to",
		"http://example.test",
		"https://video.example.test/watch?v=abc&t=10s#start",
		"HTTPS://EXAMPLE.TEST/",
	])("accepts %j", (url) => {
		expect(checkInstructionsUrl(url)).toBeUndefined();
	});

	it.each([
		["no scheme", "example.test/how-to"],
		["a script", "javascript:alert(1)"],
		["inline data", "data:text/html,<b>hi</b>"],
		["another scheme", "ftp://example.test/file"],
		["mail", "mailto:someone@example.test"],
		["no host", "https://"],
		["not a URL", "how to squat"],
	])("rejects %s", (_label, url) => {
		expect(checkInstructionsUrl(url)).toMatch(/http/);
	});

	it("rejects a URL longer than the cap", () => {
		const url = `https://example.test/${"a".repeat(MAX_INSTRUCTIONS_URL_LENGTH)}`;
		expect(checkInstructionsUrl(url)).toMatch(/2,000/);
	});

	it("accepts a URL exactly at the cap", () => {
		const base = "https://example.test/";
		const url = base + "a".repeat(MAX_INSTRUCTIONS_URL_LENGTH - base.length);
		expect(url).toHaveLength(MAX_INSTRUCTIONS_URL_LENGTH);
		expect(checkInstructionsUrl(url)).toBeUndefined();
	});
});

describe("prepareInstructions", () => {
	it("keeps tidied text and link", () => {
		expect(
			prepareInstructions({
				text: "  Brace, then pull.  ",
				url: " https://example.test/row ",
			}),
		).toEqual({
			ok: true,
			instructions: {
				instructions: "Brace, then pull.",
				instructionsUrl: "https://example.test/row",
			},
		});
	});

	it("stores blank fields as nothing, so clearing both removes them", () => {
		const result = prepareInstructions({ text: " ", url: "" });
		expect(result).toEqual({ ok: true, instructions: {} });
		if (!result.ok) return;
		expect(Object.hasOwn(result.instructions, "instructions")).toBe(false);
		expect(Object.hasOwn(result.instructions, "instructionsUrl")).toBe(false);
	});

	it("allows text alone and a link alone", () => {
		expect(prepareInstructions({ text: "Hold.", url: "" })).toEqual({
			ok: true,
			instructions: { instructions: "Hold." },
		});
		expect(
			prepareInstructions({ text: "", url: "https://example.test" }),
		).toEqual({
			ok: true,
			instructions: { instructionsUrl: "https://example.test" },
		});
	});

	it("rejects text over the cap, counted after trimming", () => {
		const atCap = "a".repeat(MAX_INSTRUCTIONS_LENGTH);
		expect(prepareInstructions({ text: ` ${atCap} `, url: "" }).ok).toBe(true);
		expect(prepareInstructions({ text: `${atCap}a`, url: "" })).toEqual({
			ok: false,
			field: "text",
			reason: expect.stringMatching(/2,000/),
		});
	});

	it("rejects a bad link, naming the link", () => {
		expect(
			prepareInstructions({ text: "Fine.", url: "example.test/row" }),
		).toEqual({
			ok: false,
			field: "url",
			reason: expect.stringMatching(/http/),
		});
	});
});
