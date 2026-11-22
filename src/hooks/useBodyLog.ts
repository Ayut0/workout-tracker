import { useLiveQuery } from "dexie-react-hooks";
import {
	type BodyEntryInput,
	deleteBodyEntry,
	listBodyEntries,
	saveBodyEntry,
} from "../db/bodyLog";
import type { BodyEntry } from "../db/types";

/** Every body log entry, oldest day first, live; undefined while loading. */
export function useBodyEntries(): BodyEntry[] | undefined {
	return useLiveQuery(() => listBodyEntries(), []);
}

/** The body log write actions, bound to the app database. */
export const bodyLogActions = {
	save: (input: BodyEntryInput): Promise<BodyEntry> => saveBodyEntry(input),
	remove: (id: string): Promise<boolean> => deleteBodyEntry(id),
};
