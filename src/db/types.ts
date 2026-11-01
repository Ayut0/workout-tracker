/**
 * Data model for the workout log. Everything lives on the device in IndexedDB.
 *
 * Units are fixed at storage time: weight in kg, distance in metres, time in
 * seconds. The kg/lb setting only changes how values are shown and entered.
 */

/** How a set of this exercise is recorded. */
export type Measure =
	| "weight_reps" // weight × reps (bench press)
	| "reps" // reps only (hanging knee raise)
	| "time" // seconds (plank, stretching)
	| "distance_time" // distance + seconds (treadmill)
	| "time_sides"; // seconds per side (mobility holds)

export type Category =
	| "chest"
	| "back"
	| "legs"
	| "shoulders"
	| "arms"
	| "core"
	| "cardio"
	| "mobility"
	| "other";

export interface Exercise {
	id: string;
	name: string;
	category: Category;
	measure: Measure;
	/** Weight is assistance (assisted chin-up): a lower number is stronger. */
	isAssisted: boolean;
	defaultRestSec: number;
	/** 0 or 1, so it can be indexed (IndexedDB cannot index booleans). */
	archived: 0 | 1;
	createdAt: number;
}

export interface Template {
	id: string;
	name: string;
	order: number;
	createdAt: number;
}

export interface TemplateItem {
	id: string;
	templateId: string;
	exerciseId: string;
	order: number;
	targetSets: number;
	targetReps?: number;
	targetSeconds?: number;
}

export type WorkoutSource = "manual" | "strong";

export interface Workout {
	id: string;
	name: string;
	/** Epoch milliseconds. */
	startedAt: number;
	endedAt?: number;
	notes?: string;
	source: WorkoutSource;
	templateId?: string;
}

export interface WorkoutItem {
	id: string;
	workoutId: string;
	exerciseId: string;
	order: number;
	restSec?: number;
	notes?: string;
}

export type SetKind = "warmup" | "working" | "drop";
export type Side = "left" | "right";

export interface WorkoutSet {
	id: string;
	workoutItemId: string;
	/** 1-based position within the exercise. */
	index: number;
	kind: SetKind;
	weightKg?: number;
	reps?: number;
	seconds?: number;
	distanceM?: number;
	side?: Side;
	rpe?: number;
	completedAt?: number;
}

export type WeightUnit = "kg" | "lb";

export interface Setting {
	key: "unit";
	value: WeightUnit;
}

/**
 * One rest-timer notification, kept so we can measure how late the lock-screen
 * notification arrives. The service worker fills in receivedAt.
 */
export interface RestTimer {
	id: string;
	/** When the notification should fire (epoch ms). */
	scheduledAt: number;
	createdAt: number;
	status: "pending" | "received" | "cancelled" | "failed";
	receivedAt?: number;
	error?: string;
}
