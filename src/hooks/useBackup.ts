import { startTransition, useState } from "react";
import {
	type Backup,
	type BackupCounts,
	exportBackup,
	previewRestore,
	type RestorePreview,
	recordLastBackup,
	restoreBackup,
} from "../db/backup";
import { parseBackup } from "../db/backupFormat";
import {
	nameBackupFile,
	SAVE_OUTCOME,
	type SaveTarget,
	saveBackupFile,
} from "../lib/backupFile";
import { requestPersistentStorage } from "../lib/persistentStorage";
import { readPersisted } from "../lib/setupState";

/** How long a download link's blob URL is kept, so the download can start. */
const REVOKE_DELAY_MS = 60_000;

/** Where backup or restore is: one flow at a time. */
export type BackupState =
	| { step: "idle" }
	| { step: "busy"; message: string }
	/** The share sheet needs a tap of its own; the file is ready. */
	| { step: "needsTap"; file: File; exportedAt: number }
	| { step: "saved"; exportedAt: number }
	| {
			step: "preview";
			backup: Backup;
			preview: RestorePreview;
			migratedFrom?: number;
	  }
	| { step: "restored"; counts: BackupCounts; exportedAt: number }
	| { step: "error"; message: string };

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function downloadFile(file: File) {
	const url = URL.createObjectURL(file);
	const link = document.createElement("a");
	link.href = url;
	link.download = file.name;
	document.body.append(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

function findSaveTarget(): SaveTarget {
	const target: SaveTarget = { download: downloadFile };
	if (typeof navigator.share === "function") {
		target.share = (data) => navigator.share(data);
	}
	if (typeof navigator.canShare === "function") {
		target.canShare = (data) => navigator.canShare(data);
	}
	return target;
}

/**
 * Backup and restore. Back up: read every store, save the file through the
 * share sheet or a download, record when. Restore: read and check the file,
 * preview it against what is stored, and only on confirm ask for persistent
 * storage and replace everything in one transaction.
 */
export function useBackup() {
	const [state, setState] = useState<BackupState>({ step: "idle" });
	const [persisted, setPersisted] = useState(() =>
		readPersisted(navigator.storage),
	);

	async function run(message: string, work: () => Promise<void>) {
		setState({ step: "busy", message });
		try {
			await work();
		} catch (error) {
			setState({ step: "error", message: describeError(error) });
		}
	}

	async function save(file: File, exportedAt: number) {
		const outcome = await saveBackupFile(file, findSaveTarget());
		if (outcome === SAVE_OUTCOME.cancelled) {
			setState({ step: "idle" });
			return;
		}
		if (outcome === SAVE_OUTCOME.needsTap) {
			setState({ step: "needsTap", file, exportedAt });
			return;
		}
		await recordLastBackup(exportedAt);
		setState({ step: "saved", exportedAt });
	}

	return {
		state,
		/** Whether the browser keeps this site's data; a promise for use(). */
		persisted,
		/** Builds the backup file and saves it. */
		backUp: () =>
			run("Preparing the backup…", async () => {
				const backup = await exportBackup(Date.now());
				const file = new File(
					[JSON.stringify(backup)],
					nameBackupFile(backup.exportedAt),
					{ type: "application/json" },
				);
				await save(file, backup.exportedAt);
			}),
		/** Saves a prepared file; called straight from a tap. */
		saveFile: (file: File, exportedAt: number) =>
			run("Saving the backup…", () => save(file, exportedAt)),
		/** Reads and checks a backup file and shows what restoring it would do. */
		chooseFile: (file: File) =>
			run("Reading the backup…", async () => {
				const parsed = parseBackup(await file.text());
				if (!parsed.ok) {
					setState({ step: "error", message: parsed.reason });
					return;
				}
				const preview = await previewRestore(parsed.backup);
				setState({
					step: "preview",
					backup: parsed.backup,
					preview,
					...(parsed.migratedFrom !== undefined
						? { migratedFrom: parsed.migratedFrom }
						: {}),
				});
			}),
		/** Replaces all data with the previewed backup. */
		confirmRestore: (backup: Backup, counts: BackupCounts) =>
			run("Restoring…", async () => {
				await requestPersistentStorage(navigator.storage);
				startTransition(() => setPersisted(readPersisted(navigator.storage)));
				await restoreBackup(backup);
				await recordLastBackup(backup.exportedAt);
				setState({ step: "restored", counts, exportedAt: backup.exportedAt });
			}),
		reset: () => setState({ step: "idle" }),
	};
}
