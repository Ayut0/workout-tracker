/** Saving a backup file, and when to nudge for a new one (ADR-0011). */

const DAY_MS = 86_400_000;

/** A backup older than this many days is due; so is having none. */
export const BACKUP_DUE_DAYS = 30;

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

/** The file name for a backup made at `at`, dated in local time. */
export function nameBackupFile(at: number): string {
	const d = new Date(at);
	return `workout-tracker-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** True when there is no backup yet, or the last is over BACKUP_DUE_DAYS old. */
export function isBackupDue(
	lastBackupAt: number | undefined,
	now: number,
): boolean {
	return (
		lastBackupAt === undefined || now - lastBackupAt > BACKUP_DUE_DAYS * DAY_MS
	);
}

/** Whole days since `at`, never negative. */
export function countDaysSince(at: number, now: number): number {
	return Math.max(0, Math.floor((now - at) / DAY_MS));
}

export const SAVE_OUTCOME = {
	shared: "shared",
	downloaded: "downloaded",
	cancelled: "cancelled",
	/** The share sheet needs a fresh tap (the first one's activation expired). */
	needsTap: "needsTap",
} as const;

export type SaveOutcome = (typeof SAVE_OUTCOME)[keyof typeof SAVE_OUTCOME];

/** The browser features saving uses; injected so tests can stand in. */
export interface SaveTarget {
	canShare?: (data: ShareData) => boolean;
	share?: (data: ShareData) => Promise<void>;
	/** Starts a download of the file (an <a download> link). */
	download: (file: File) => void;
}

function isNamedError(error: unknown, name: string): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === name
	);
}

/**
 * Saves the file through the share sheet when the browser can share files
 * (iOS: Save to Files, AirDrop, Mail), else downloads it.
 */
export async function saveBackupFile(
	file: File,
	target: SaveTarget,
): Promise<SaveOutcome> {
	const data: ShareData = { files: [file], title: file.name };
	if (target.share && target.canShare?.(data)) {
		try {
			await target.share(data);
			return SAVE_OUTCOME.shared;
		} catch (error) {
			if (isNamedError(error, "AbortError")) return SAVE_OUTCOME.cancelled;
			if (isNamedError(error, "NotAllowedError")) return SAVE_OUTCOME.needsTap;
			throw error;
		}
	}
	target.download(file);
	return SAVE_OUTCOME.downloaded;
}
