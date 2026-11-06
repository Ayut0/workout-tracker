import { describe, expect, it } from "vitest";
import { isPlainClick, parseRoute, TABS, templatePath } from "./routes";

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

	it("puts the template editor under the Workout tab", () => {
		expect(parseRoute("/templates/new")).toEqual({
			name: "template-new",
			tab: "workout",
		});
		expect(parseRoute("/templates/abc-123")).toEqual({
			name: "template-edit",
			tab: "workout",
			templateId: "abc-123",
		});
		expect(parseRoute("/templates/abc-123/")?.name).toBe("template-edit");
	});

	it("round-trips a template id through its path", () => {
		const id = "a b/c%";
		expect(parseRoute(templatePath(id))).toEqual({
			name: "template-edit",
			tab: "workout",
			templateId: id,
		});
	});

	it("has no template list or nested template page", () => {
		expect(parseRoute("/templates")).toBeNull();
		expect(parseRoute("/templates/abc/edit")).toBeNull();
		expect(parseRoute("/templates/%E0%A4%A")).toBeNull();
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
