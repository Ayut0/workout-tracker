/// <reference lib="webworker" />
import {
	cleanupOutdatedCaches,
	type PrecacheEntry,
	precacheAndRoute,
} from "workbox-precaching";
import { markTimerReceived } from "./db";

declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: Array<PrecacheEntry | string>;
};

// App shell for offline use (the list is injected at build time).
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("install", () => {
	void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

// Pushes carry no payload: every push means "the rest timer is over".
self.addEventListener("push", (event) => {
	const receivedAt = Date.now();
	event.waitUntil(
		Promise.all([
			self.registration.showNotification("Rest over", {
				body: "Time for your next set",
				tag: "rest-timer",
				icon: "/icons/icon-192.png",
			}),
			// Record arrival time so the app can show how late the push was.
			markTimerReceived(receivedAt).catch(() => undefined),
		]),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	event.waitUntil(
		(async () => {
			const windows = await self.clients.matchAll({
				type: "window",
				includeUncontrolled: true,
			});
			const open = windows[0];
			if (open) {
				await open.focus();
				return;
			}
			await self.clients.openWindow("/");
		})(),
	);
});
