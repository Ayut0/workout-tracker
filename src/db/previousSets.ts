import { db, type WorkoutDB } from "./index";
import type { Workout, WorkoutSet } from "./types";

/**
 * The Previous column (#28): what an exercise's sets did the last time it was
 * performed. "Last time" is the most recently started finished workout (one
 * with `endedAt`) in which the exercise has at least one complete set, so the
 * active workout never counts and neither does a finished workout where the
 * exercise was added but never done. Imported Strong workouts are ordinary
 * finished workouts with complete sets, so they count too.
 *
 * Only complete sets are returned, in order: an incomplete set in a finished
 * workout was never lifted. If the exercise appears more than once in that
 * workout, its appearances are joined in workout order (the first
 * appearance's sets, then the next's), so set N of today lines up with the
 * N-th set done last time.
 *
 * Reads only the exercise's own appearances (indexed by exerciseId) and the
 * sets of the one workout chosen, never the whole history.
 */
export async function listPreviousSets(
	exerciseId: string,
	database: WorkoutDB = db,
): Promise<WorkoutSet[]> {
	return database.transaction(
		"r",
		[database.workouts, database.workoutExercises, database.sets],
		async () => {
			const appearances = await database.workoutExercises
				.where("exerciseId")
				.equals(exerciseId)
				.toArray();
			const workouts = await database.workouts.bulkGet([
				...new Set(appearances.map((we) => we.workoutId)),
			]);
			const finished = workouts
				.filter((workout): workout is Workout => workout?.endedAt !== undefined)
				.sort((a, b) => b.startedAt - a.startedAt);
			for (const workout of finished) {
				const inWorkout = appearances
					.filter((we) => we.workoutId === workout.id)
					.sort((a, b) => a.order - b.order);
				const sets = await database.sets
					.where("workoutExerciseId")
					.anyOf(inWorkout.map((we) => we.id))
					.toArray();
				const done = inWorkout.flatMap((we) =>
					sets
						.filter(
							(set) =>
								set.workoutExerciseId === we.id &&
								set.completedAt !== undefined,
						)
						.sort((a, b) => a.order - b.order),
				);
				if (done.length > 0) return done;
			}
			return [];
		},
	);
}
