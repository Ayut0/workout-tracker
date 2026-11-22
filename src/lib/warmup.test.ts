import { describe, expect, it } from "vitest";
import { toggleWarmup } from "./warmup";

describe("toggleWarmup", () => {
	it("marks a working set as a warm-up", () => {
		expect(toggleWarmup(undefined)).toBe(true);
		expect(toggleWarmup(false)).toBe(true);
	});

	it("clears the mark of a warm-up (stored as no field)", () => {
		expect(toggleWarmup(true)).toBeUndefined();
	});
});
