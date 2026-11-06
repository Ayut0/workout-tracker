export const SETTINGS_PATH = "/settings";
export const NOTIFICATION_CHECK_PATH = `${SETTINGS_PATH}/notifications`;
export const HISTORY_PATH = "/history";
export const TEMPLATES_PATH = "/templates";
export const NEW_TEMPLATE_PATH = `${TEMPLATES_PATH}/new`;

/** The bottom tab bar, in display order. Workout lives at the root so the app opens on it. */
export const TABS = [
	{ id: "workout", label: "Workout", path: "/" },
	{ id: "history", label: "History", path: HISTORY_PATH },
	{ id: "exercises", label: "Exercises", path: "/exercises" },
	{ id: "progress", label: "Progress", path: "/progress" },
	{ id: "settings", label: "Settings", path: SETTINGS_PATH },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/** One screen of the app, and the tab it belongs to. */
export type Route =
	| { name: TabId; tab: TabId }
	| { name: "notification-check"; tab: "settings" }
	| { name: "history-detail"; tab: "history"; workoutId: string }
	| { name: "template-new"; tab: "workout" }
	| { name: "template-edit"; tab: "workout"; templateId: string };

/** The path of one past workout in History. */
export function historyDetailPath(workoutId: string): string {
	return `${HISTORY_PATH}/${encodeURIComponent(workoutId)}`;
}

/** The path of a template's editor. */
export function templatePath(templateId: string): string {
	return `${TEMPLATES_PATH}/${encodeURIComponent(templateId)}`;
}

/**
 * The id in a path one segment below `base`, e.g. "/history/<id>";
 * undefined for any other path.
 */
function readIdBelow(base: string, path: string): string | undefined {
	const prefix = `${base}/`;
	if (!path.startsWith(prefix)) return undefined;
	const segment = path.slice(prefix.length);
	if (segment === "" || segment.includes("/")) return undefined;
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
}

/** The screen for a URL pathname, or null when nothing lives there. */
export function parseRoute(pathname: string): Route | null {
	const path =
		pathname.length > 1 && pathname.endsWith("/")
			? pathname.slice(0, -1)
			: pathname;
	if (path === NOTIFICATION_CHECK_PATH) {
		return { name: "notification-check", tab: "settings" };
	}
	const workoutId = readIdBelow(HISTORY_PATH, path);
	if (workoutId !== undefined) {
		return { name: "history-detail", tab: "history", workoutId };
	}
	if (path === NEW_TEMPLATE_PATH) {
		return { name: "template-new", tab: "workout" };
	}
	const templateId = readIdBelow(TEMPLATES_PATH, path);
	if (templateId !== undefined) {
		return { name: "template-edit", tab: "workout", templateId };
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
