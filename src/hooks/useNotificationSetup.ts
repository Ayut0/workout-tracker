import { useEffect, useState } from "react";
import {
	currentSubscription,
	enableNotifications,
	isStandalone,
	type PermissionState,
	permissionState,
} from "../lib/push";

/** Home Screen / permission / subscription / storage state, and the tap that enables push. */
export function useNotificationSetup() {
	const [standalone] = useState(isStandalone);
	const [permission, setPermission] =
		useState<PermissionState>(permissionState);
	const [subscription, setSubscription] = useState<PushSubscription | null>(
		null,
	);
	const [persisted, setPersisted] = useState<boolean | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		currentSubscription()
			.then(setSubscription)
			.catch(() => setSubscription(null));
		navigator.storage
			?.persisted?.()
			.then(setPersisted)
			.catch(() => setPersisted(null));
	}, []);

	async function enable() {
		setError(null);
		setBusy(true);
		try {
			const sub = await enableNotifications();
			setSubscription(sub);
			// Ask the browser to keep our data; Home Screen apps are favoured.
			setPersisted((await navigator.storage?.persist?.()) ?? null);
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
