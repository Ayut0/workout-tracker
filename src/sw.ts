/// <reference lib="webworker" />
import {
	cleanupOutdatedCaches,
	type PrecacheEntry,
	precacheAndRoute,
} from "workbox-precaching";

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
