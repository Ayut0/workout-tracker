import { afterEach, describe, expect, it, vi } from "vitest";
import {
	readPersisted,
	readSubscription,
	SUBSCRIPTION_TIMEOUT_MS,
} from "./setupState";

const subscription = { endpoint: "https://push.example/abc" };

afterEach(() => {
	vi.useRealTimers();
});

describe("readSubscription", () => {
	it("resolves to the current subscription", async () => {
		await expect(
			readSubscription(() => Promise.resolve(subscription)),
		).resolves.toBe(subscription);
	});

	it("resolves to null when there is none", async () => {
		await expect(readSubscription(() => Promise.resolve(null))).resolves.toBe(
			null,
		);
	});

	it("resolves to null when the read fails", async () => {
		await expect(
			readSubscription(() => Promise.reject(new Error("no sw"))),
		).resolves.toBe(null);
	});

	it("resolves to null when the service worker never becomes ready", async () => {
		vi.useFakeTimers();
		const result = readSubscription(() => new Promise(() => {}));

		await vi.advanceTimersByTimeAsync(SUBSCRIPTION_TIMEOUT_MS);

		await expect(result).resolves.toBe(null);
	});
});

describe("readPersisted", () => {
	it("resolves to what the browser reports", async () => {
		await expect(
			readPersisted({ persisted: () => Promise.resolve(true) }),
		).resolves.toBe(true);
	});

	it("resolves to null when the storage API is missing", async () => {
		await expect(readPersisted(undefined)).resolves.toBe(null);
	});

	it("resolves to null when the read fails", async () => {
		await expect(
			readPersisted({ persisted: () => Promise.reject(new Error("denied")) }),
		).resolves.toBe(null);
	});
});
