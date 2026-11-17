import { useSyncExternalStore } from "react";
import { getCurrentPath, subscribePath } from "../lib/navigation";
import { parseRoute } from "../lib/routes";

/** The screen for the current URL; re-renders on navigate() and back / forward. */
export function useRoute() {
	return parseRoute(useSyncExternalStore(subscribePath, getCurrentPath));
}
