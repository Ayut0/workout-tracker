import { describe, expect, it } from "vitest";
import type { BodyEntry } from "../db/types";
import {
	buildBodySeries,
	formatBodyValue,
	formatLocalDay,
	parseBodyEntryForm,
	toBodyEntryForm,
} from "./bodyLog";
import { KG_PER_LB } from "./units";

describe("formatLocalDay", () => {
	it("gives the local calendar day, zero-padded", () => {
		expect(formatLocalDay(new Date(2026, 0, 5, 23, 59).getTime())).toBe(
			"2026-01-05",
		);
		expect(formatLocalDay(new Date(2026, 10, 15, 0, 0).getTime())).toBe(
			"2026-11-15",
		);
	});
});

describe("parseBodyEntryForm", () => {
	it("reads body weight in the user's unit as kg and waist as cm", () => {
		expect(
			parseBodyEntryForm(
				{ date: "2026-01-02", bodyWeight: "154", waist: "80,5" },
				"lb",
			),
		).toEqual({
			ok: true,
			input: {
				date: "2026-01-02",
				bodyWeightKg: 154 * KG_PER_LB,
				waistCm: 80.5,
			},
		});
	});

	it("leaves out a measurement left blank", () => {
		expect(
			parseBodyEntryForm(
				{ date: "2026-01-02", bodyWeight: " 70 ", waist: "  " },
				"kg",
			),
		).toEqual({ ok: true, input: { date: "2026-01-02", bodyWeightKg: 70 } });
	});

	it("keeps a stored value the user did not change, unrounded", () => {
		const stored: BodyEntry = {
			id: "b",
			date: "2026-01-02",
			bodyWeightKg: 70,
			waistCm: 80.25,
		};
		// 70 kg shows as "154.3" lb and 80.25 cm as "80.3": re-reading those
		// texts would store 69.99 kg and 80.3 cm.
		expect(
			parseBodyEntryForm(
				toBodyEntryForm(stored, "2026-01-02", "lb"),
				"lb",
				stored,
			),
		).toEqual({
			ok: true,
			input: { date: "2026-01-02", bodyWeightKg: 70, waistCm: 80.25 },
		});
		expect(
			parseBodyEntryForm(
				{ date: "2026-01-02", bodyWeight: "154.3", waist: "81" },
				"lb",
				stored,
			),
		).toEqual({
			ok: true,
			input: { date: "2026-01-02", bodyWeightKg: 70, waistCm: 81 },
		});
	});

	it("does not keep another day's stored values", () => {
		const stored: BodyEntry = { id: "b", date: "2026-01-01", bodyWeightKg: 70 };
		expect(
			parseBodyEntryForm(
				{ date: "2026-01-02", bodyWeight: "154.3", waist: "" },
				"lb",
				stored,
			),
		).toEqual({
			ok: true,
			input: { date: "2026-01-02", bodyWeightKg: 154.3 * KG_PER_LB },
		});
	});

	it("needs at least one measurement", () => {
		expect(
			parseBodyEntryForm(
				{ date: "2026-01-02", bodyWeight: "", waist: "" },
				"kg",
			),
		).toEqual({
			ok: false,
			field: "bodyWeight",
			message: "Enter a body weight, a waist measurement or both.",
		});
	});

	it.each([
		["date", { date: "2026-02-30", bodyWeight: "70", waist: "" }],
		["bodyWeight", { date: "2026-01-02", bodyWeight: "seventy", waist: "" }],
		["bodyWeight", { date: "2026-01-02", bodyWeight: "0", waist: "" }],
		["waist", { date: "2026-01-02", bodyWeight: "70", waist: "-80" }],
	] as const)("points at the %s field when it is not valid", (field, form) => {
		expect(parseBodyEntryForm(form, "kg")).toMatchObject({ ok: false, field });
	});
});

describe("toBodyEntryForm", () => {
	it("shows a stored entry in the user's unit, blank when absent", () => {
		expect(
			toBodyEntryForm(
				{ id: "b", date: "2026-01-02", bodyWeightKg: 100 },
				"2026-01-02",
				"lb",
			),
		).toEqual({ date: "2026-01-02", bodyWeight: "220.5", waist: "" });
		expect(toBodyEntryForm(undefined, "2026-01-03", "kg")).toEqual({
			date: "2026-01-03",
			bodyWeight: "",
			waist: "",
		});
	});
});

const ENTRIES: BodyEntry[] = [
	{ id: "a", date: "2026-01-01", bodyWeightKg: 100, waistCm: 80 },
	{ id: "b", date: "2026-01-02", waistCm: 79.5 },
	{ id: "c", date: "2026-01-03", bodyWeightKg: 99 },
];

describe("buildBodySeries", () => {
	it("charts body weight in the user's unit, skipping days without it", () => {
		expect(buildBodySeries(ENTRIES, "bodyWeight", "lb")).toEqual([
			{
				id: "a",
				date: new Date(2026, 0, 1).getTime(),
				value: 100 / KG_PER_LB,
			},
			{ id: "c", date: new Date(2026, 0, 3).getTime(), value: 99 / KG_PER_LB },
		]);
	});

	it("charts waist in cm whatever the weight unit", () => {
		expect(buildBodySeries(ENTRIES, "waist", "lb").map((d) => d.value)).toEqual(
			[80, 79.5],
		);
	});
});

describe("formatBodyValue", () => {
	it("shows one decimal place with the unit", () => {
		expect(formatBodyValue(220.462, "bodyWeight", "lb")).toBe("220.5 lb");
		expect(formatBodyValue(80, "waist", "lb")).toBe("80 cm");
	});
});
