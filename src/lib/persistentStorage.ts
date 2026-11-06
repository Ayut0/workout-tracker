/**
 * Asks the browser to keep this site's data under storage pressure instead
 * of evicting it. Call it before a large write such as the Strong import.
 * Resolves to the browser's answer, or null when it cannot say (no storage
 * API, or the request failed). Never rejects: the write goes ahead either way.
 */
export async function requestPersistentStorage(
	storage: Partial<Pick<StorageManager, "persist">> | undefined,
): Promise<boolean | null> {
	try {
		return (await storage?.persist?.()) ?? null;
	} catch {
		return null;
	}
}
