import { startTransition, useState } from "react";
import {
	currentSubscription,
	enableNotifications,
	isStandalone,
	type PermissionState,
	permissionState,
} from "../lib/push";
import { readPersisted, readSubscription } from "../lib/setupState";

/**
 * Home Screen / permission / subscription / storage state, and the tap that enables push.
 * Subscription and storage are promises: read them with use() under a Suspense boundary.
 */
export function useNotificationSetup() {
	const [standalone] = useState(isStandalone);
	const [permission, setPermission] =
		useState<PermissionState>(permissionState);
	const [subscription, setSubscription] = useState(() =>
		readSubscription(currentSubscription),
	);
	const [persisted, setPersisted] = useState(() =>
		readPersisted(navigator.storage),
	);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function enable() {
		setError(null);
		setBusy(true);
		try {
			const sub = await enableNotifications();
			// A transition keeps the screen showing while use() reads the new promise.
			startTransition(() => setSubscription(Promise.resolve(sub)));
			// Ask the browser to keep our data; Home Screen apps are favoured.
			const kept = (await navigator.storage?.persist?.()) ?? null;
			startTransition(() => setPersisted(Promise.resolve(kept)));
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setPermission(permissionState());
			setBusy(false);
		}
	}

	return {
		standalone,
		permission,
		subscription,
		persisted,
		busy,
		error,
		enable,
	};
}
