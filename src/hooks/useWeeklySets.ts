import { useLiveQuery } from "dexie-react-hooks";
import { listWorkoutsStartedBetween } from "../db/history";
import {
	addWeeks,
	countWeeklySets,
	type MuscleSetCount,
} from "../lib/weeklySets";

/**
 * Hard sets per muscle group in the week starting `weekStart` (Monday 00:00
 * local), live; undefined while loading.
 */
export function useWeeklySets(weekStart: number): MuscleSetCount[] | undefined {
	const result = useLiveQuery(async () => {
		const workouts = await listWorkoutsStartedBetween(
			weekStart,
			addWeeks(weekStart, 1),
		);
		return { weekStart, counts: countWeeklySets(workouts, weekStart) };
	}, [weekStart]);
	// useLiveQuery keeps the previous result until the new query resolves;
	// never show one week's sets under another week's dates.
	return result?.weekStart === weekStart ? result.counts : undefined;
}
