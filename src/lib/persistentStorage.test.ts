import { describe, expect, it, vi } from "vitest";
import { requestPersistentStorage } from "./persistentStorage";

describe("requestPersistentStorage", () => {
	it("asks the browser and resolves to its answer", async () => {
		const persist = vi.fn(() => Promise.resolve(true));

		await expect(requestPersistentStorage({ persist })).resolves.toBe(true);
		expect(persist).toHaveBeenCalledOnce();
	});

	it("resolves to null when the storage API is missing", async () => {
		await expect(requestPersistentStorage(undefined)).resolves.toBe(null);
		await expect(requestPersistentStorage({})).resolves.toBe(null);
	});

	it("resolves to null when the request fails", async () => {
		await expect(
			requestPersistentStorage({
				persist: () => Promise.reject(new Error("denied")),
			}),
		).resolves.toBe(null);
	});
});
