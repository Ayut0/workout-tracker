import { describe, expect, it } from "vitest";
import {
	formatRestDuration,
	MAX_REST_SECONDS,
	MIN_REST_SECONDS,
	parseRestSeconds,
	resolveRestSeconds,
} from "./restDuration";

const settings = { weightUnit: "kg", restSeconds: 90 } as const;

describe("resolveRestSeconds", () => {
	it("uses the default rest when the exercise has no override", () => {
		expect(resolveRestSeconds({}, settings)).toBe(90);
		expect(resolveRestSeconds(undefined, settings)).toBe(90);
	});

	it("uses the exercise's own rest when set", () => {
		expect(resolveRestSeconds({ restSeconds: 180 }, settings)).toBe(180);
	});
});

describe("parseRestSeconds", () => {
	it("reads plain seconds", () => {
		expect(parseRestSeconds("90")).toBe(90);
		expect(parseRestSeconds(" 120 ")).toBe(120);
	});

	it("reads minutes and seconds", () => {
		expect(parseRestSeconds("1:30")).toBe(90);
		expect(parseRestSeconds("3:00")).toBe(180);
	});

	it("rejects malformed input", () => {
		expect(parseRestSeconds("")).toBeUndefined();
		expect(parseRestSeconds("1.5")).toBeUndefined();
		expect(parseRestSeconds("1:75")).toBeUndefined();
		expect(parseRestSeconds("abc")).toBeUndefined();
		expect(parseRestSeconds("-30")).toBeUndefined();
	});

	it("rejects durations outside the allowed range", () => {
		expect(parseRestSeconds(String(MIN_REST_SECONDS - 1))).toBeUndefined();
		expect(parseRestSeconds(String(MIN_REST_SECONDS))).toBe(MIN_REST_SECONDS);
		expect(parseRestSeconds(String(MAX_REST_SECONDS))).toBe(MAX_REST_SECONDS);
		expect(parseRestSeconds(String(MAX_REST_SECONDS + 1))).toBeUndefined();
	});
});

describe("formatRestDuration", () => {
	it("shows minutes and seconds", () => {
		expect(formatRestDuration(90)).toBe("1:30");
		expect(formatRestDuration(45)).toBe("0:45");
		expect(formatRestDuration(600)).toBe("10:00");
	});
});
