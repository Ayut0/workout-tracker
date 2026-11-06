import { useLiveQuery } from "dexie-react-hooks";
import { listPreviousSets } from "../db/previousSets";
import type { WorkoutSet } from "../db/types";

/**
 * The Previous column's sets for each exercise in the active workout, by
 * exercise id, live. One `listPreviousSets` query per distinct exercise, each
 * reading only that exercise's appearances, so typing in today's sets does not
 * rescan history. Undefined while loading.
 */
export function usePreviousSets(
	exerciseIds: readonly string[],
): ReadonlyMap<string, WorkoutSet[]> | undefined {
	const ids = [...new Set(exerciseIds)].sort();
	const key = ids.join("\n");
	// `key` stands for `ids`: re-query only when the set of exercises changes,
	// not on every render of the workout.
	return useLiveQuery(async () => {
		const entries = await Promise.all(
			ids.map(
				async (id): Promise<[string, WorkoutSet[]]> => [
					id,
					await listPreviousSets(id),
				],
			),
		);
		return new Map(entries);
	}, [key]);
}
