import { describe, expect, it } from "vitest";
import sample from "../../fixtures/strong-sample.csv?raw";
import {
	countSets,
	PARSE_KIND,
	parseCsvRecords,
	parseStrongCsv,
	parseStrongDate,
	parseStrongDuration,
	type StrongParseResult,
} from "./strongCsv";

const LB_TO_KG = 0.45359237;

function expectParsed(result: StrongParseResult) {
	if (result.kind !== PARSE_KIND.parsed) {
		throw new Error(`expected parsed, got ${JSON.stringify(result)}`);
	}
	return result;
}

describe("parseCsvRecords", () => {
	it("handles quoted commas, newlines, escaped quotes and CRLF", () => {
		const text = 'a,b,c\r\n1,"x, y","say ""hi"""\r\n2,"line1\nline2",\r\n';
		expect(parseCsvRecords(text, ",")).toEqual([
			{ line: 1, fields: ["a", "b", "c"] },
			{ line: 2, fields: ["1", "x, y", 'say "hi"'] },
			{ line: 3, fields: ["2", "line1\nline2", ""] },
		]);
	});

	it("skips blank lines and a leading byte order mark", () => {
		expect(parseCsvRecords("﻿a;b\n\n1;2", ";")).toEqual([
			{ line: 1, fields: ["a", "b"] },
			{ line: 3, fields: ["1", "2"] },
		]);
	});
});

describe("parseStrongDuration", () => {
	it.each([
		["1h 5m", 3900],
		["45m", 2700],
		["30s", 30],
		["1h", 3600],
		["2h 3m 4s", 7384],
		[" 1h  5m ", 3900],
	])("reads %s as %i seconds", (text, seconds) => {
		expect(parseStrongDuration(text)).toBe(seconds);
	});

	it.each(["", "soon", "5", "1x", "m"])("rejects %j", (text) => {
		expect(parseStrongDuration(text)).toBeUndefined();
	});
});

describe("parseStrongDate", () => {
	it("reads the date as local time", () => {
		expect(parseStrongDate("2026-01-05 07:30:00")).toBe(
			new Date(2026, 0, 5, 7, 30, 0).getTime(),
		);
	});

	it.each(["", "not-a-date", "2026-13-01 00:00:00", "2026-02-30 10:00:00"])(
		"rejects %j",
		(text) => {
			expect(parseStrongDate(text)).toBeUndefined();
		},
	);
});

describe("parseStrongCsv with the synthetic fixture", () => {
	const result = expectParsed(
		parseStrongCsv(sample, { weightUnit: "kg", distanceUnit: "km" }),
	);

	it("groups rows into workouts, exercises and sets", () => {
		expect(result.workouts.map((w) => w.name)).toEqual([
			"Push Day",
			"Evening Run",
			"Legs",
		]);
		expect(result.workouts.length).toBe(3);
		expect(countSets(result.workouts)).toBe(12);
		const [push, run, legs] = result.workouts;
		expect(push?.exercises.map((e) => [e.name, e.sets.length])).toEqual([
			["Bench Press (Barbell)", 4],
			["Overhead Press (Barbell)", 2],
		]);
		expect(run?.exercises.map((e) => e.name)).toEqual(["Running", "Plank"]);
		// An exercise done again later in the workout is a second entry.
		expect(legs?.exercises.map((e) => [e.name, e.sets.length])).toEqual([
			["Squat (Barbell)", 2],
			["Leg Press", 1],
			["Squat (Barbell)", 1],
		]);
	});

	it("reads workout times, duration and notes", () => {
		const push = result.workouts[0];
		const startedAt = new Date(2026, 0, 5, 7, 30).getTime();
		expect(push?.startedAt).toBe(startedAt);
		expect(push?.endedAt).toBe(startedAt + 3900 * 1000);
		expect(push?.notes).toBe("Felt strong, slept well");
		expect(result.workouts[1]?.notes).toBeUndefined();
	});

	it("keeps warm-up and drop sets and reads each measurement", () => {
		const bench = result.workouts[0]?.exercises[0]?.sets;
		expect(bench).toEqual([
			{ weightKg: 40, reps: 10 },
			{
				weightKg: 80,
				reps: 5,
				rpe: 8,
				notes: "Paused reps,\ntwo second pause",
			},
			{ weightKg: 80, reps: 5, rpe: 8.5 },
			{ weightKg: 60, reps: 8 },
		]);
		expect(result.workouts[0]?.exercises[1]?.sets[0]?.notes).toBe(
			'Said "easy"',
		);
		expect(result.workouts[1]?.exercises).toEqual([
			{ name: "Running", sets: [{ distanceM: 5200, seconds: 1800 }] },
			{ name: "Plank", sets: [{ seconds: 60 }] },
		]);
	});

	it("reports skipped rows with their line and reason", () => {
		expect(result.skipped).toEqual([
			{ line: 8, reason: "Rest timer row" },
			{ line: 16, reason: 'Invalid date "not-a-date"' },
			{ line: 17, reason: "Missing exercise name" },
			{ line: 18, reason: "Expected 12 columns, found 4" },
		]);
	});
});

describe("parseStrongCsv units", () => {
	const header =
		"Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE";
	const row = "2026-01-05 07:30:00,A,30m,Bench Press (Barbell),1,100,5,1,0,,,";

	it("asks for the units when the header does not say", () => {
		expect(parseStrongCsv(`${header}\n${row}`)).toEqual({
			kind: PARSE_KIND.needsUnits,
			missing: ["weight", "distance"],
		});
	});

	it("does not ask for a unit no row uses", () => {
		const noDistance = row.replace(",5,1,0,", ",5,0,0,");
		const result = expectParsed(
			parseStrongCsv(`${header}\n${noDistance}`, { weightUnit: "kg" }),
		);
		expect(result.workouts[0]?.exercises[0]?.sets).toEqual([
			{ weightKg: 100, reps: 5 },
		]);
	});

	it("converts pounds and miles given as options", () => {
		const result = expectParsed(
			parseStrongCsv(`${header}\n${row}`, {
				weightUnit: "lb",
				distanceUnit: "mi",
			}),
		);
		expect(result.workouts[0]?.exercises[0]?.sets[0]).toEqual({
			weightKg: 100 * LB_TO_KG,
			reps: 5,
			distanceM: 1609.344,
		});
	});

	it("reads units, seconds duration and workout number from a newer header", () => {
		const text = [
			'"Workout #","Date","Workout Name","Duration (sec)","Exercise Name","Set Order","Weight (lbs)","Reps","RPE","Distance (miles)","Seconds","Notes","Workout Notes"',
			'"1","2026-02-01 09:00:00","Pull","3600","Deadlift (Barbell)","1","225","5","","","","",""',
			'"1","2026-02-01 09:00:00","Pull","3600","Deadlift (Barbell)","F","225","3","9","","","",""',
		].join("\n");
		const result = expectParsed(parseStrongCsv(text, { weightUnit: "kg" }));
		expect(result.weightUnit).toBe("lb");
		const workout = result.workouts[0];
		expect(workout?.endedAt).toBe(
			new Date(2026, 1, 1, 9).getTime() + 3600 * 1000,
		);
		expect(workout?.exercises[0]?.sets).toEqual([
			{ weightKg: 225 * LB_TO_KG, reps: 5 },
			{ weightKg: 225 * LB_TO_KG, reps: 3, rpe: 9 },
		]);
	});

	it("reads per-row unit columns", () => {
		const text = [
			"Date,Workout Name,Exercise Name,Set Order,Weight,Weight Unit,Reps,RPE,Distance,Distance Unit,Seconds,Notes,Workout Notes,Workout Duration",
			"2026-03-01 10:00:00,Mix,Bench Press (Barbell),1,135,lbs,5,,,,,,,1h",
			"2026-03-01 10:00:00,Mix,Rowing (Machine),1,,,,,2000,m,480,,,1h",
		].join("\n");
		const result = expectParsed(parseStrongCsv(text));
		expect(result.workouts[0]?.exercises.map((e) => e.sets)).toEqual([
			[{ weightKg: 135 * LB_TO_KG, reps: 5 }],
			[{ distanceM: 2000, seconds: 480 }],
		]);
	});

	it("reads semicolon-separated exports with decimal commas", () => {
		const text = [
			header.replaceAll(",", ";"),
			'2026-01-05 07:30:00;A;30m;Curl;1;12,5;10;0;0;"a; b";;',
		].join("\n");
		const result = expectParsed(parseStrongCsv(text, { weightUnit: "kg" }));
		expect(result.workouts[0]?.exercises[0]?.sets).toEqual([
			{ weightKg: 12.5, reps: 10, notes: "a; b" },
		]);
	});
});

describe("parseStrongCsv rejects files it cannot read", () => {
	it("rejects an empty file", () => {
		expect(parseStrongCsv("")).toEqual({
			kind: PARSE_KIND.invalid,
			reason: "The file is empty",
		});
	});

	it("names the required columns that are missing", () => {
		expect(parseStrongCsv("Date,Reps\n2026-01-05 07:30:00,5")).toEqual({
			kind: PARSE_KIND.invalid,
			reason:
				"Not a Strong export: missing columns Workout Name, Exercise Name",
		});
	});

	it("skips a row whose measurement is not a number", () => {
		const text =
			'Date,Workout Name,Exercise Name,Weight,Reps\n2026-01-05 07:30:00,A,Curl,"1,234.5",5';
		const result = expectParsed(parseStrongCsv(text, { weightUnit: "kg" }));
		expect(result.workouts).toEqual([]);
		expect(result.skipped).toEqual([
			{ line: 2, reason: 'Invalid weight "1,234.5"' },
		]);
	});

	it.each(["2026-01-05 24:00:00", "2026-01-05 07:60:00"])(
		"skips the impossible time %j",
		(date) => {
			expect(parseStrongDate(date)).toBeUndefined();
		},
	);

	it("ends a workout at its start when the duration is unreadable", () => {
		const text =
			"Date,Workout Name,Duration,Exercise Name,Reps\n2026-01-05 07:30:00,A,?,Curl,5";
		const result = expectParsed(parseStrongCsv(text));
		expect(result.workouts[0]?.endedAt).toBe(result.workouts[0]?.startedAt);
	});
});
