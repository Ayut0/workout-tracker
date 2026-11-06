// Client-side navigation on the History API. pushState fires no event, so navigate()
// raises its own and subscribers listen for it alongside popstate (back / forward).
const NAVIGATE = "app:navigate";

export function currentPath(): string {
	return window.location.pathname;
}

/** Goes to `path`; `replace` swaps the current history entry, e.g. after deleting what it showed. */
export function navigate(path: string, { replace = false } = {}): void {
	if (path === currentPath()) return;
	if (replace) window.history.replaceState(null, "", path);
	else window.history.pushState(null, "", path);
	window.scrollTo(0, 0);
	window.dispatchEvent(new Event(NAVIGATE));
}

export function subscribePath(onChange: () => void): () => void {
	window.addEventListener("popstate", onChange);
	window.addEventListener(NAVIGATE, onChange);
	return () => {
		window.removeEventListener("popstate", onChange);
		window.removeEventListener(NAVIGATE, onChange);
	};
}
