/** The bottom tab bar, in display order. Workout lives at the root so the app opens on it. */
export const TABS = [
	{ id: "workout", label: "Workout", path: "/" },
	{ id: "history", label: "History", path: "/history" },
	{ id: "exercises", label: "Exercises", path: "/exercises" },
	{ id: "progress", label: "Progress", path: "/progress" },
	{ id: "settings", label: "Settings", path: "/settings" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/** One screen of the app, and the tab it belongs to. */
export type Route =
	| { name: TabId; tab: TabId }
	| { name: "notification-check"; tab: "settings" };

export const NOTIFICATION_CHECK_PATH = "/settings/notifications";

/** The screen for a URL pathname, or null when nothing lives there. */
export function parseRoute(pathname: string): Route | null {
	const path =
		pathname.length > 1 && pathname.endsWith("/")
			? pathname.slice(0, -1)
			: pathname;
	if (path === NOTIFICATION_CHECK_PATH) {
		return { name: "notification-check", tab: "settings" };
	}
	const tab = TABS.find((t) => t.path === path);
	return tab ? { name: tab.id, tab: tab.id } : null;
}

type ClickLike = {
	button: number;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
	defaultPrevented: boolean;
};

/** True for a click the app should handle itself; modified clicks keep their browser meaning (new tab etc). */
export function isPlainClick(e: ClickLike): boolean {
	return (
		e.button === 0 &&
		!e.metaKey &&
		!e.ctrlKey &&
		!e.shiftKey &&
		!e.altKey &&
		!e.defaultPrevented
	);
}
