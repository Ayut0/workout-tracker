import { db, findActiveWorkout, type WorkoutDB } from "./index";

/** What the rest timer watches in the workout log. */
export interface RestWatch {
	activeWorkoutId: string | null;
	/** The set the rest was started by; done is false once it is uncompleted or removed. */
	set?: { id: string; done: boolean };
}

/**
 * The active workout and, when resting, whether the rest's set is still done.
 * Read it live, so finishing, discarding or uncompleting ends the rest.
 */
export async function readRestWatch(
	setId: string | undefined,
	database: WorkoutDB = db,
): Promise<RestWatch> {
	const workout = await findActiveWorkout(database);
	const watch: RestWatch = { activeWorkoutId: workout?.id ?? null };
	if (setId === undefined) return watch;
	const set = await database.sets.get(setId);
	return { ...watch, set: { id: setId, done: set?.completedAt !== undefined } };
}
