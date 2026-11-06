import { useSyncExternalStore } from "react";
import { currentPath, subscribePath } from "../lib/navigation";
import { parseRoute } from "../lib/routes";

/** The screen for the current URL; re-renders on navigate() and back / forward. */
export function useRoute() {
	return parseRoute(useSyncExternalStore(subscribePath, currentPath));
}
