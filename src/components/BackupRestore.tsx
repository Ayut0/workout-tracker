import { type ChangeEvent, Suspense, use } from "react";
import {
	BACKUP_STORES,
	type Backup,
	type BackupCounts,
	type BackupStore,
	type RestorePreview,
} from "../db/backup";
import { useBackup } from "../hooks/useBackup";
import { useSettings } from "../hooks/useSettings";
import { countDaysSince, isBackupDue } from "../lib/backupFile";

const STORE_LABELS: Record<BackupStore, string> = {
	exercises: "Exercises",
	workouts: "Workouts",
	workoutExercises: "Workout exercises",
	sets: "Sets",
	templates: "Templates",
	settings: "Settings",
};

function formatDate(epochMs: number): string {
	return new Date(epochMs).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatAge(at: number, now: number): string {
	const days = countDaysSince(at, now);
	if (days === 0) return "today";
	return days === 1 ? "yesterday" : `${days} days ago`;
}

function formatRecords(count: number): string {
	return `${count.toLocaleString()} ${count === 1 ? "record" : "records"}`;
}

function countAll(counts: BackupCounts): number {
	return BACKUP_STORES.reduce((sum, store) => sum + counts[store], 0);
}

/** Settings → Backup: save all data to a file, and restore from one. */
export function BackupRestore() {
	const { settings } = useSettings();
	const backup = useBackup();
	const { state } = backup;
	const now = Date.now();
	const { lastBackupAt } = settings;
	const due = isBackupDue(lastBackupAt, now);

	function pick(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		// Clear it so choosing the same file again fires a change.
		e.target.value = "";
		if (file) backup.chooseFile(file);
	}

	return (
		<div className="stack backup">
			<ul className="checks backup-status">
				<li className={due ? "warn" : undefined}>
					{lastBackupAt === undefined
						? "No backup yet. Your data lives only on this phone — back it up to a file."
						: `Last backup: ${formatDate(lastBackupAt)} (${formatAge(lastBackupAt, now)})${due ? ". Time for a new one." : ""}`}
				</li>
				<li>
					<Suspense fallback="Storage: checking…">
						<StorageStatus persisted={backup.persisted} />
					</Suspense>
				</li>
			</ul>

			{state.step === "idle" && (
				<>
					<button
						type="button"
						className={due ? "primary" : "secondary"}
						onClick={backup.backUp}
					>
						Back up now
					</button>
					<label className="secondary file-pick">
						Restore from backup
						<input
							type="file"
							accept=".json,application/json"
							className="visually-hidden"
							onChange={pick}
						/>
					</label>
				</>
			)}
			{state.step === "busy" && (
				<p className="lead" role="status">
					{state.message}
				</p>
			)}
			{state.step === "needsTap" && (
				<>
					<p className="lead">The backup file is ready.</p>
					<button
						type="button"
						className="primary"
						onClick={() => backup.saveFile(state.file, state.exportedAt)}
					>
						Save backup file
					</button>
					<button type="button" className="secondary" onClick={backup.reset}>
						Cancel
					</button>
				</>
			)}
			{state.step === "saved" && (
				<>
					<p className="notice" role="status">
						Backup saved. Keep the file somewhere off this phone, such as iCloud
						Drive.
					</p>
					<button type="button" className="secondary" onClick={backup.reset}>
						Done
					</button>
				</>
			)}
			{state.step === "preview" && (
				<RestorePreviewPanel
					backup={state.backup}
					preview={state.preview}
					migratedFrom={state.migratedFrom}
					onConfirm={() =>
						backup.confirmRestore(state.backup, state.preview.incoming)
					}
					onCancel={backup.reset}
				/>
			)}
			{state.step === "restored" && (
				<>
					<p className="notice" role="status">
						Restored the backup from {formatDate(state.exportedAt)} (
						{formatRecords(countAll(state.counts))}).
					</p>
					<button type="button" className="secondary" onClick={backup.reset}>
						Done
					</button>
				</>
			)}
			{state.step === "error" && (
				<>
					<p className="error" role="alert">
						{state.message}
					</p>
					<button type="button" className="secondary" onClick={backup.reset}>
						OK
					</button>
				</>
			)}
		</div>
	);
}

function StorageStatus({ persisted }: { persisted: Promise<boolean | null> }) {
	const kept = use(persisted);
	if (kept === true) return "Storage: kept on this phone (persistent).";
	if (kept === false) {
		return "Storage: not persistent — the browser may clear it when space runs low. Add the app to the Home Screen and back up often.";
	}
	return "Storage: this browser cannot say whether it keeps the data.";
}

type RestorePreviewPanelProps = {
	backup: Backup;
	preview: RestorePreview;
	migratedFrom: number | undefined;
	onConfirm: () => void;
	onCancel: () => void;
};

/** The backup against what is stored; nothing is written until confirm. */
function RestorePreviewPanel({
	backup,
	preview,
	migratedFrom,
	onConfirm,
	onCancel,
}: RestorePreviewPanelProps) {
	const { currentActive } = preview;
	const empty = countAll(preview.incoming) === 0;
	return (
		<div className="stack">
			<p className="lead">
				Backup from {formatDate(backup.exportedAt)}
				{migratedFrom !== undefined &&
					` (an older data version, ${migratedFrom}; updated to read here)`}
				.
			</p>
			<table className="restore-table">
				<thead>
					<tr>
						<th scope="col">Records</th>
						<th scope="col">In backup</th>
						<th scope="col">Here now</th>
					</tr>
				</thead>
				<tbody>
					{BACKUP_STORES.map((store) => (
						<tr key={store}>
							<th scope="row">{STORE_LABELS[store]}</th>
							<td>{preview.incoming[store].toLocaleString()}</td>
							<td>{preview.current[store].toLocaleString()}</td>
						</tr>
					))}
				</tbody>
			</table>
			<p className="warn" role="alert">
				Restoring REPLACES all data on this phone with the backup. Everything
				here now is deleted
				{currentActive
					? `, including your workout in progress (“${currentActive.name}”)`
					: ""}
				.{empty && " This backup holds no records, so nothing will be left."}
				{preview.incomingActive &&
					` The backup's unfinished workout (“${preview.incomingActive.name}”) becomes your workout in progress.`}
			</p>
			<button
				type="button"
				className="danger restore-confirm"
				onClick={onConfirm}
			>
				Replace all data with this backup
			</button>
			<button type="button" className="secondary" onClick={onCancel}>
				Cancel
			</button>
		</div>
	);
}
