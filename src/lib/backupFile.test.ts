import { describe, expect, it, vi } from "vitest";
import {
	BACKUP_DUE_DAYS,
	countDaysSince,
	isBackupDue,
	nameBackupFile,
	SAVE_OUTCOME,
	saveBackupFile,
} from "./backupFile";

const DAY_MS = 86_400_000;
const NOW = new Date(2026, 10, 6, 12).getTime();

function makeFile() {
	return new File(["{}"], "workout-tracker-backup-2026-11-06.json", {
		type: "application/json",
	});
}

function namedError(name: string): Error {
	const error = new Error(name);
	error.name = name;
	return error;
}

describe("nameBackupFile", () => {
	it("dates the file in local time", () => {
		expect(nameBackupFile(new Date(2026, 0, 5, 23, 59).getTime())).toBe(
			"workout-tracker-backup-2026-01-05.json",
		);
	});
});

describe("isBackupDue", () => {
	it("is due when there has never been a backup", () => {
		expect(isBackupDue(undefined, NOW)).toBe(true);
	});

	it("is not due within the window and due after it", () => {
		expect(isBackupDue(NOW - BACKUP_DUE_DAYS * DAY_MS, NOW)).toBe(false);
		expect(isBackupDue(NOW - BACKUP_DUE_DAYS * DAY_MS - 1, NOW)).toBe(true);
	});
});

describe("countDaysSince", () => {
	it("counts whole days and never goes negative", () => {
		expect(countDaysSince(NOW - 2.5 * DAY_MS, NOW)).toBe(2);
		expect(countDaysSince(NOW + DAY_MS, NOW)).toBe(0);
	});
});

describe("saveBackupFile", () => {
	it("shares the file when the browser can share files", async () => {
		const share = vi.fn(() => Promise.resolve());
		const download = vi.fn();
		const file = makeFile();

		const outcome = await saveBackupFile(file, {
			canShare: () => true,
			share,
			download,
		});

		expect(outcome).toBe(SAVE_OUTCOME.shared);
		expect(share).toHaveBeenCalledWith({ files: [file], title: file.name });
		expect(download).not.toHaveBeenCalled();
	});

	it("downloads when files cannot be shared", async () => {
		const share = vi.fn(() => Promise.resolve());
		const download = vi.fn();

		const outcome = await saveBackupFile(makeFile(), {
			canShare: () => false,
			share,
			download,
		});

		expect(outcome).toBe(SAVE_OUTCOME.downloaded);
		expect(share).not.toHaveBeenCalled();
		expect(download).toHaveBeenCalledOnce();
	});

	it("downloads when there is no Web Share API", async () => {
		const download = vi.fn();
		await expect(saveBackupFile(makeFile(), { download })).resolves.toBe(
			SAVE_OUTCOME.downloaded,
		);
	});

	it.each([
		["AbortError", SAVE_OUTCOME.cancelled],
		["NotAllowedError", SAVE_OUTCOME.needsTap],
	])("reports %s from the share sheet", async (name, expected) => {
		const outcome = await saveBackupFile(makeFile(), {
			canShare: () => true,
			share: () => Promise.reject(namedError(name)),
			download: vi.fn(),
		});
		expect(outcome).toBe(expected);
	});

	it("passes other share failures on", async () => {
		await expect(
			saveBackupFile(makeFile(), {
				canShare: () => true,
				share: () => Promise.reject(namedError("DataError")),
				download: vi.fn(),
			}),
		).rejects.toThrow("DataError");
	});
});
