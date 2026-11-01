import Dexie, { type EntityTable } from "dexie";
import type {
	Exercise,
	RestTimer,
	Setting,
	Template,
	TemplateItem,
	Workout,
	WorkoutItem,
	WorkoutSet,
} from "./types";

export const DB_NAME = "workout-tracker";

export class WorkoutDB extends Dexie {
	exercises!: EntityTable<Exercise, "id">;
	templates!: EntityTable<Template, "id">;
	templateItems!: EntityTable<TemplateItem, "id">;
	workouts!: EntityTable<Workout, "id">;
	workoutItems!: EntityTable<WorkoutItem, "id">;
	sets!: EntityTable<WorkoutSet, "id">;
	settings!: EntityTable<Setting, "key">;
	restTimers!: EntityTable<RestTimer, "id">;

	constructor(name = DB_NAME) {
		super(name);
		// Only indexed fields are listed; other fields are stored as-is.
		// A schema change means a new this.version(n) block, never editing this one.
		this.version(1).stores({
			exercises: "id, &name, category, archived",
			templates: "id, order",
			templateItems: "id, templateId, [templateId+order]",
			workouts: "id, startedAt, source",
			workoutItems: "id, workoutId, exerciseId, [workoutId+order]",
			sets: "id, workoutItemId, [workoutItemId+index]",
			settings: "key",
			restTimers: "id, scheduledAt, status",
		});
	}
}

export const db = new WorkoutDB();

/** Returns the most recent pending timer, the one a push just arrived for. */
export async function latestPendingTimer(
	database: WorkoutDB = db,
): Promise<RestTimer | undefined> {
	return database.restTimers
		.where("status")
		.equals("pending")
		.reverse()
		.sortBy("scheduledAt")
		.then((timers) => timers[0]);
}

/** Marks the latest pending timer as received now; returns it, if any. */
export async function markTimerReceived(
	receivedAt: number,
	database: WorkoutDB = db,
): Promise<RestTimer | undefined> {
	const timer = await latestPendingTimer(database);
	if (!timer) return undefined;
	await database.restTimers.update(timer.id, {
		status: "received",
		receivedAt,
	});
	return { ...timer, status: "received", receivedAt };
}
