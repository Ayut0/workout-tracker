import { describe, expect, it } from "vitest";
import { isPlainClick, parseRoute, TABS } from "./routes";

describe("parseRoute", () => {
	it("opens the Workout tab at the root", () => {
		expect(parseRoute("/")).toEqual({ name: "workout", tab: "workout" });
	});

	it.each([
		["/history", "history"],
		["/exercises", "exercises"],
		["/progress", "progress"],
		["/settings", "settings"],
	] as const)("maps %s to its tab", (path, tab) => {
		expect(parseRoute(path)).toEqual({ name: tab, tab });
	});

	it("puts the notification check under the Settings tab", () => {
		expect(parseRoute("/settings/notifications")).toEqual({
			name: "notification-check",
			tab: "settings",
		});
	});

	it("ignores a trailing slash", () => {
		expect(parseRoute("/history/")).toEqual({
			name: "history",
			tab: "history",
		});
		expect(parseRoute("/settings/notifications/")?.name).toBe(
			"notification-check",
		);
	});

	it("returns null for an unknown path", () => {
		expect(parseRoute("/nope")).toBeNull();
		expect(parseRoute("/history/nope")).toBeNull();
		expect(parseRoute("/workout")).toBeNull();
	});

	it("resolves every tab's own path to that tab", () => {
		for (const tab of TABS) {
			expect(parseRoute(tab.path)?.tab).toBe(tab.id);
		}
	});
});

describe("isPlainClick", () => {
	const plain = {
		button: 0,
		metaKey: false,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		defaultPrevented: false,
	};

	it("accepts an unmodified primary click", () => {
		expect(isPlainClick(plain)).toBe(true);
	});

	it.each([
		["a middle click", { button: 1 }],
		["cmd-click", { metaKey: true }],
		["ctrl-click", { ctrlKey: true }],
		["shift-click", { shiftKey: true }],
		["alt-click", { altKey: true }],
		["an already handled click", { defaultPrevented: true }],
	])("leaves %s to the browser", (_, change) => {
		expect(isPlainClick({ ...plain, ...change })).toBe(false);
	});
});
