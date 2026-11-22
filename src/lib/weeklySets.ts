import { MUSCLE_GROUPS } from "../db/constants";
import type { MuscleGroup, Workout, WorkoutSet } from "../db/types";
import { countsAsWorkingSet } from "./metrics";

/**
 * Weekly sets per muscle group (#75): how many hard sets each muscle group
 * got in a week, by fractional counting (Pelland et al. 2025). A complete,
 * non-warm-up set counts 1 for each of its exercise's primary muscles and
 * 0.5 for each secondary muscle. A week starts Monday 00:00 local time (the
 * first instant of Monday where a daylight-saving change skips midnight), and
 * a workout belongs to the week it started in.
 */

/** What a set counts towards its primary and secondary muscles. */
const PRIMARY_SHARE = 1;
const SECONDARY_SHARE = 0.5;

const DAYS_PER_WEEK = 7;

/** The set fields the count reads: whether it is done and a warm-up. */
export type WeeklySetsSet = Pick<WorkoutSet, "completedAt" | "warmup">;

/** The exercise attributes the count reads. */
export interface WeeklySetsExercise {
	primaryMuscles?: readonly MuscleGroup[];
	secondaryMuscles?: readonly MuscleGroup[];
}

/** A workout as the count reads it: its start and its exercises' sets. */
export interface WeeklySetsWorkout {
	workout: Pick<Workout, "startedAt">;
	exercises: readonly {
		/** Undefined if the exercise was deleted from the library. */
		exercise: WeeklySetsExercise | undefined;
		sets: readonly WeeklySetsSet[];
	}[];
}

/** One muscle group's hard sets in a week: a whole or half number. */
export interface MuscleSetCount {
	muscle: MuscleGroup;
	sets: number;
}

/**
 * The first instant of the local calendar date `year-month-day` (`day` may
 * overflow the month). `new Date(y, m, d)` is 00:00 when that exists; where a
 * daylight-saving change skips midnight (Havana, Cairo, Santiago, Beirut) the
 * engine moves it forward to the first instant that does exist, e.g. 01:00.
 */
function startOfDate(year: number, month: number, day: number): number {
	return new Date(year, month, day).getTime();
}

/**
 * The start of the week `time` falls in: the first instant of its Monday
 * (epoch ms), which is 00:00 local time unless a daylight-saving change
 * skips midnight that day.
 */
export function startOfWeek(time: number): number {
	const date = new Date(time);
	// getDay() is 0 on Sunday; count days back to Monday.
	const daysSinceMonday = (date.getDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
	return startOfDate(
		date.getFullYear(),
		date.getMonth(),
		date.getDate() - daysSinceMonday,
	);
}

/**
 * The start of the week `weeks` after the week starting `weekStart` (before
 * it when negative). Steps whole calendar days from the Monday's date rather
 * than adding 24-hour days, so weeks tile the time line across daylight-saving
 * changes, even ones that skip or repeat midnight: week n ends exactly where
 * week n + 1 starts.
 */
export function addWeeks(weekStart: number, weeks: number): number {
	const monday = new Date(weekStart);
	return startOfDate(
		monday.getFullYear(),
		monday.getMonth(),
		monday.getDate() + weeks * DAYS_PER_WEEK,
	);
}

/**
 * The week to show after stepping `weeks` from `shown`, as the pinned week the
 * screen keeps. `shown` is undefined while following the current week, which
 * is `thisWeek`. Never goes past the current week: stepping up to it (or past
 * it) returns undefined, meaning "follow the current week", so a screen left
 * open across Monday 00:00 rolls over instead of staying on last week.
 */
export function shiftWeek(
	shown: number | undefined,
	thisWeek: number,
	weeks: number,
): number | undefined {
	const next = addWeeks(shown ?? thisWeek, weeks);
	return next >= thisWeek ? undefined : next;
}

/**
 * Hard sets per muscle group in the week starting `weekStart`, from the
 * workouts that started in it. Only muscles with sets are listed, most sets
 * first; equal counts keep the muscle vocabulary's order. A muscle listed as
 * both primary and secondary counts as primary.
 */
export function countWeeklySets(
	workouts: readonly WeeklySetsWorkout[],
	weekStart: number,
): MuscleSetCount[] {
	const weekEnd = addWeeks(weekStart, 1);
	const totals = new Map<MuscleGroup, number>();
	for (const workout of workouts) {
		const { startedAt } = workout.workout;
		if (startedAt < weekStart || startedAt >= weekEnd) continue;
		for (const { exercise, sets } of workout.exercises) {
			const hardSets = sets.filter(countsAsWorkingSet).length;
			if (hardSets === 0 || exercise === undefined) continue;
			const primary = new Set(exercise.primaryMuscles);
			for (const muscle of primary) {
				add(totals, muscle, hardSets * PRIMARY_SHARE);
			}
			for (const muscle of new Set(exercise.secondaryMuscles)) {
				if (!primary.has(muscle)) {
					add(totals, muscle, hardSets * SECONDARY_SHARE);
				}
			}
		}
	}
	return MUSCLE_GROUPS.flatMap((muscle) => {
		const sets = totals.get(muscle);
		return sets === undefined ? [] : [{ muscle, sets }];
	}).sort((a, b) => b.sets - a.sets);
}

function add(totals: Map<MuscleGroup, number>, muscle: MuscleGroup, n: number) {
	totals.set(muscle, (totals.get(muscle) ?? 0) + n);
}

/** A set count for display: "3", or "2.5" for a half. */
export function formatSetCount(sets: number): string {
	return String(sets);
}
