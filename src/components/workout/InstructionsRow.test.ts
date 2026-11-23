import { describe, expect, it } from "vitest";
import { InstructionsRow } from "./InstructionsRow";

describe("InstructionsRow", () => {
	it("renders nothing without text or a safe link", () => {
		for (const props of [
			{ instructions: undefined, instructionsUrl: undefined },
			{ instructions: "  ", instructionsUrl: "" },
			{ instructions: undefined, instructionsUrl: "javascript:alert(1)" },
		]) {
			expect(InstructionsRow(props)).toBeNull();
		}
	});

	it("renders a row for text, a safe link, or both", () => {
		for (const props of [
			{ instructions: "Lorem.", instructionsUrl: undefined },
			{ instructions: undefined, instructionsUrl: "https://example.test" },
			{ instructions: "Lorem.", instructionsUrl: "https://example.test" },
		]) {
			expect(InstructionsRow(props)).not.toBeNull();
		}
	});
});
