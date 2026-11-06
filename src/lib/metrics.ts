/**
 * Progress metrics: Estimated 1RM, Volume and personal records, as pure
 * functions over stored sets. Weights are kg and never rounded here; rounding
 * happens at display (ADR-0002).
 *
 * Only complete sets with a positive weight and positive reps count. A
 * bodyweight set (0 kg or no weight) or a set with 0 reps contributes no
 * Estimated 1RM and 0 Volume.
 */
import type { Workout, WorkoutSet } from "../db/types";

/**
 * Reps above this count as this many for Estimated 1RM. Epley's error grows
 * quickly past about 10 reps, so a 20-rep set would claim an unrealistic 1RM;
 * capping keeps the estimate conservative while more reps never lower it.
 */
export const E1RM_MAX_REPS = 12;

/** The divisor in Epley's formula: e1RM = weight × (1 + reps / 30). */
const EPLEY_DIVISOR = 30;

/** A set that counts towards metrics, with its load and reps known. */
interface LoadedSet {
	weightKg: number;
	reps: number;
}

function readLoadedSet(set: WorkoutSet): LoadedSet | undefined {
	const { completedAt, weightKg, reps } = set;
	if (completedAt === undefined) return undefined;
	if (weightKg === undefined || weightKg <= 0) return undefined;
	if (reps === undefined || reps <= 0) return undefined;
	return { weightKg, reps };
}

/**
 * Estimated 1RM of one set, by Epley: weight × (1 + reps / 30), with reps
 * capped at E1RM_MAX_REPS. A single rep is the weight itself. Undefined for an
 * incomplete set, 0 or missing reps, and 0 kg or missing weight.
 */
export function estimateOneRepMax(set: WorkoutSet): number | undefined {
	const loaded = readLoadedSet(set);
	if (!loaded) return undefined;
	if (loaded.reps === 1) return loaded.weightKg;
	const reps = Math.min(loaded.reps, E1RM_MAX_REPS);
	return loaded.weightKg * (1 + reps / EPLEY_DIVISOR);
}

/** The highest Estimated 1RM among the sets; undefined if none has one. */
export function findBestEstimatedOneRepMax(
	sets: readonly WorkoutSet[],
): number | undefined {
	return findMax(sets.map(estimateOneRepMax));
}

/** Volume: Σ weight × reps over complete sets (full reps, no cap). */
export function sumVolume(sets: readonly WorkoutSet[]): number {
	let total = 0;
	for (const set of sets) {
		const loaded = readLoadedSet(set);
		if (loaded) total += loaded.weightKg * loaded.reps;
	}
	return total;
}

/** The heaviest weight lifted in a complete set; undefined if none. */
function findHeaviestWeight(sets: readonly WorkoutSet[]): number | undefined {
	return findMax(sets.map((set) => readLoadedSet(set)?.weightKg));
}

function findMax(values: readonly (number | undefined)[]): number | undefined {
	let max: number | undefined;
	for (const value of values) {
		if (value !== undefined && (max === undefined || value > max)) max = value;
	}
	return max;
}

/**
 * One appearance of an exercise in a workout. `ExerciseHistoryEntry` from
 * `listExerciseHistory` (src/db) fits this shape, so charts pass it straight in.
 */
export interface ExerciseHistoryInput {
	workout: Pick<Workout, "id" | "startedAt">;
	sets: readonly WorkoutSet[];
}

/** An exercise's metrics in one workout: one point on a progress chart. */
export interface ProgressPoint {
	workoutId: string;
	/** The workout's start time (epoch ms). */
	date: number;
	/** Undefined when no set has an Estimated 1RM (e.g. bodyweight only). */
	bestE1rmKg: number | undefined;
	volumeKg: number;
	maxWeightKg: number | undefined;
}

/**
 * One point per workout for an exercise, oldest first. Entries of the same
 * workout (the exercise added twice) are merged. Workouts with no complete
 * set are skipped; ones whose complete sets carry no load (bodyweight) are
 * kept with 0 Volume and no Estimated 1RM.
 */
export function listProgressPoints(
	history: readonly ExerciseHistoryInput[],
): ProgressPoint[] {
	const byWorkout = new Map<string, { date: number; sets: WorkoutSet[] }>();
	for (const { workout, sets } of history) {
		const complete = sets.filter((set) => set.completedAt !== undefined);
		const existing = byWorkout.get(workout.id);
		if (existing) existing.sets.push(...complete);
		else byWorkout.set(workout.id, { date: workout.startedAt, sets: complete });
	}
	const points: ProgressPoint[] = [];
	for (const [workoutId, { date, sets }] of byWorkout) {
		if (sets.length === 0) continue;
		points.push({
			workoutId,
			date,
			bestE1rmKg: findBestEstimatedOneRepMax(sets),
			volumeKg: sumVolume(sets),
			maxWeightKg: findHeaviestWeight(sets),
		});
	}
	return points.sort((a, b) => a.date - b.date);
}

/** A personal record and the workout it was set in. */
export interface PersonalRecord {
	kg: number;
	workoutId: string;
	/** The workout's start time (epoch ms). */
	date: number;
}

/** An exercise's personal records; each undefined until one exists. */
export interface PersonalRecords {
	bestE1rm: PersonalRecord | undefined;
	heaviestWeight: PersonalRecord | undefined;
	/** The highest Volume in a single workout. */
	bestVolume: PersonalRecord | undefined;
}

/**
 * Best Estimated 1RM, heaviest weight and best single-workout Volume for an
 * exercise. On a tie the earliest workout holds the record.
 */
export function findPersonalRecords(
	history: readonly ExerciseHistoryInput[],
): PersonalRecords {
	const points = listProgressPoints(history);
	return {
		bestE1rm: findRecord(points, (point) => point.bestE1rmKg),
		heaviestWeight: findRecord(points, (point) => point.maxWeightKg),
		bestVolume: findRecord(points, (point) =>
			point.volumeKg > 0 ? point.volumeKg : undefined,
		),
	};
}

function findRecord(
	points: readonly ProgressPoint[],
	readKg: (point: ProgressPoint) => number | undefined,
): PersonalRecord | undefined {
	let record: PersonalRecord | undefined;
	for (const point of points) {
		const kg = readKg(point);
		if (kg !== undefined && (record === undefined || kg > record.kg)) {
			record = { kg, workoutId: point.workoutId, date: point.date };
		}
	}
	return record;
}
