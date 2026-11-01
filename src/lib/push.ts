/**
 * Notification permission, push subscription, and calls to the timer worker.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";
const PUSH_API_URL = (import.meta.env.VITE_PUSH_API_URL ?? "").replace(
	/\/$/,
	"",
);

export function isConfigured(): boolean {
	return VAPID_PUBLIC_KEY.length > 0 && PUSH_API_URL.length > 0;
}

/** True when opened from the Home Screen icon (required for push on iOS). */
export function isStandalone(): boolean {
	const nav = navigator as Navigator & { standalone?: boolean };
	return (
		window.matchMedia("(display-mode: standalone)").matches ||
		nav.standalone === true
	);
}

export type PermissionState = NotificationPermission | "unsupported";

export function pushSupported(): boolean {
	return (
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		"Notification" in window
	);
}

export function permissionState(): PermissionState {
	return pushSupported() ? Notification.permission : "unsupported";
}

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
	const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
	if (!pushSupported()) return null;
	const registration = await navigator.serviceWorker.ready;
	return registration.pushManager.getSubscription();
}

/**
 * Asks for permission and subscribes. Must run inside a tap handler:
 * iOS only shows the permission dialog in response to a user gesture.
 */
export async function enableNotifications(): Promise<PushSubscription> {
	if (!pushSupported()) throw new Error("この端末では通知が使えません");
	const permission = await Notification.requestPermission();
	if (permission !== "granted") throw new Error("通知が許可されませんでした");
	const registration = await navigator.serviceWorker.ready;
	const existing = await registration.pushManager.getSubscription();
	if (existing) return existing;
	return registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
	});
}

async function callTimerApi(
	method: "POST" | "DELETE",
	body: object,
): Promise<void> {
	const response = await fetch(`${PUSH_API_URL}/timers`, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		throw new Error(
			`通知サーバーがエラーを返しました（${response.status}）${detail}`,
		);
	}
}

export function scheduleRestPush(
	subscription: PushSubscription,
	fireAt: number,
): Promise<void> {
	return callTimerApi("POST", { endpoint: subscription.endpoint, fireAt });
}

export function cancelRestPush(subscription: PushSubscription): Promise<void> {
	return callTimerApi("DELETE", { endpoint: subscription.endpoint });
}
