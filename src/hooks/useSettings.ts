import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_SETTINGS, findSettings, saveSettings } from "../db";
import type { Settings } from "../db/types";

/**
 * The user's settings, live: every screen using this re-renders when any
 * screen saves a change, so switching kg/lb updates all weights at once.
 * `settings` holds the defaults until the stored record has been read;
 * `loaded` turns true once it has.
 */
export function useSettings(): {
	settings: Settings;
	loaded: boolean;
	save: (changes: Partial<Settings>) => Promise<void>;
} {
	const stored = useLiveQuery(() => findSettings(), []);
	return {
		settings: stored ?? DEFAULT_SETTINGS,
		loaded: stored !== undefined,
		save: (changes) => saveSettings(changes),
	};
}
