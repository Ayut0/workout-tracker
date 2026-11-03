/**
 * One-off reads of the setup state, as promises for React's use().
 * Neither rejects: a failed read counts as "not ready".
 */

/**
 * How long to wait for the service worker before reporting no subscription.
 * `navigator.serviceWorker.ready` never settles if registration failed, and
 * a promise that never settles would leave the check loading forever.
 * Tapping "Allow notifications" still finds an existing subscription.
 */
export const SUBSCRIPTION_TIMEOUT_MS = 5_000;

export function readSubscription<S>(
	current: () => Promise<S | null>,
): Promise<S | null> {
	return new Promise((resolve) => {
		const timeout = setTimeout(() => resolve(null), SUBSCRIPTION_TIMEOUT_MS);
		current()
			.catch(() => null)
			.then((subscription) => {
				clearTimeout(timeout);
				resolve(subscription);
			});
	});
}

/** Null when the browser cannot say (no storage API, or the read failed). */
export async function readPersisted(
	storage: Pick<StorageManager, "persisted"> | undefined,
): Promise<boolean | null> {
	try {
		return (await storage?.persisted?.()) ?? null;
	} catch {
		return null;
	}
}
