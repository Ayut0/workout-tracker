import { describe, expect, it } from "vitest";
import {
	isAllowedPushEndpoint,
	parseCancelRequest,
	parseScheduleRequest,
} from "./validate";

const APPLE = "https://web.push.apple.com/QGuQyavXutnMbf3Q";
const NOW = 1_800_000_000_000;

describe("isAllowedPushEndpoint", () => {
	it.each([
		APPLE,
		"https://fcm.googleapis.com/fcm/send/abc",
		"https://updates.push.services.mozilla.com/wpush/v2/abc",
		"https://wns2-par02p.notify.windows.com/w/?token=abc",
	])("accepts %s", (endpoint) => {
		expect(isAllowedPushEndpoint(endpoint)).toBe(true);
	});

	it.each([
		"http://web.push.apple.com/abc",
		"https://example.com/abc",
		"https://web.push.apple.com.evil.example/abc",
		"https://notify.windows.com.evil.example/abc",
		"not a url",
	])("rejects %s", (endpoint) => {
		expect(isAllowedPushEndpoint(endpoint)).toBe(false);
	});
});

describe("parseScheduleRequest", () => {
	it("accepts a 90-second rest timer", () => {
		expect(
			parseScheduleRequest({ endpoint: APPLE, fireAt: NOW + 90_000 }, NOW),
		).toEqual({
			ok: true,
			value: { endpoint: APPLE, fireAt: NOW + 90_000 },
		});
	});

	it.each([
		["in the past", NOW - 1],
		["under 5 seconds away", NOW + 4_999],
		["over an hour away", NOW + 60 * 60 * 1000 + 1],
		["not a number", "soon"],
	])("rejects fireAt %s", (_label, fireAt) => {
		expect(parseScheduleRequest({ endpoint: APPLE, fireAt }, NOW).ok).toBe(
			false,
		);
	});

	it("rejects an endpoint outside the push services", () => {
		expect(
			parseScheduleRequest(
				{ endpoint: "https://example.com/hook", fireAt: NOW + 90_000 },
				NOW,
			).ok,
		).toBe(false);
	});

	it("rejects a body that is not an object", () => {
		expect(parseScheduleRequest(undefined, NOW).ok).toBe(false);
	});
});

describe("parseCancelRequest", () => {
	it("accepts a known endpoint", () => {
		expect(parseCancelRequest({ endpoint: APPLE })).toEqual({
			ok: true,
			value: { endpoint: APPLE },
		});
	});
});
