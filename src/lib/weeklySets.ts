import {
	MUSCLE_GROUPS,
	type MuscleGroup,
	type Workout,
	type WorkoutSet,
} from "../db/types";
import { countsAsWorkingSet } from "./metrics";

/**
 * Weekly sets per muscle group (#75): how many hard sets each muscle group
 * got in a week, by fractional counting (Pelland et al. 2025). A complete,
 * non-warm-up set counts 1 for each of its exercise's primary muscles and
 * 0.5 for each secondary muscle. A week starts Monday 00:00 local time, and
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

/** Monday 00:00 local time of the week `time` falls in (epoch ms). */
export function startOfWeek(time: number): number {
	const day = new Date(time);
	day.setHours(0, 0, 0, 0);
	// getDay() is 0 on Sunday; count days back to Monday.
	const daysSinceMonday = (day.getDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
	day.setDate(day.getDate() - daysSinceMonday);
	return day.getTime();
}

/**
 * The start of the week `weeks` after the week starting `weekStart` (before
 * it when negative). Steps calendar days, so a daylight-saving change, which
 * makes a week an hour shorter or longer, still lands on Monday 00:00.
 */
export function addWeeks(weekStart: number, weeks: number): number {
	const day = new Date(weekStart);
	day.setDate(day.getDate() + weeks * DAYS_PER_WEEK);
	return day.getTime();
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
