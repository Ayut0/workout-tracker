import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import {
	createExercise,
	type ExerciseNameResult,
	listArchivedExercises,
	listLibraryExercises,
	removeExercise,
	renameExercise,
	restoreExercise,
	setExerciseRestSeconds,
} from "../db";
import type { Exercise } from "../db/types";
import { filterExercisesByName } from "../lib/exerciseLibrary";

/**
 * Library exercises (not archived) whose name matches the query, sorted by
 * name; undefined while loading. Re-renders when the library changes. Use it
 * for any exercise picker.
 */
export function useLibraryExercises(query = ""): Exercise[] | undefined {
	const exercises = useLiveQuery(() => listLibraryExercises(), []);
	return useMemo(
		() => exercises && filterExercisesByName(exercises, query),
		[exercises, query],
	);
}

/** Archived exercises, sorted by name; undefined while loading. */
export function useArchivedExercises(): Exercise[] | undefined {
	return useLiveQuery(() => listArchivedExercises(), []);
}

/** The library's write actions, bound to the app database. */
export const exerciseLibraryActions = {
	create: (name: string): Promise<ExerciseNameResult> => createExercise(name),
	rename: (id: string, name: string): Promise<ExerciseNameResult> =>
		renameExercise(id, name),
	remove: (id: string): Promise<"deleted" | "archived"> =>
		removeExercise(id, Date.now()),
	restore: (id: string): Promise<boolean> => restoreExercise(id),
	/** Sets the exercise's own rest, or clears it (undefined) to use the default. */
	setRest: (id: string, restSeconds: number | undefined): Promise<boolean> =>
		setExerciseRestSeconds(id, restSeconds),
};
