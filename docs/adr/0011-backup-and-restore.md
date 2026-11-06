# 0011. Backup and restore: one JSON file, restore replaces everything

- Status: accepted
- Date: 2026-11-06

## Context

There is no server copy of the data (ADR-0001): a lost or reset phone, or the
browser evicting site data, loses every workout. #37 adds a backup file the
lifter keeps elsewhere (iCloud Drive, Mail) and a restore from it. Restore
writes over stored records, which AGENTS.md lists as an Escalation trigger
(destructive writes). The schema is the version-2 one from ADR-0002; this
changes no store or index.

## Decision

- **File format.** One JSON object:
  `{ format: "workout-tracker-backup", formatVersion, schemaVersion,
  exportedAt, data: { <store>: records[] } }`. `formatVersion` (now 1) versions
  the envelope; `schemaVersion` is the Dexie version the records follow
  (`db.verno`, now 2); `exportedAt` is epoch ms. Records are written as stored
  (ids, epoch ms, kg — ADR-0002). File name
  `workout-tracker-backup-YYYY-MM-DD.json`, dated in local time.
- **Stores carried:** exercises, workouts, workoutExercises, sets, templates,
  settings — every store of user data. **restTimers is left out** and a
  restore leaves it as it is: it holds notification-check diagnostics, not
  training records, and the service worker marks the latest *pending* timer
  as received, so replacing it with another phone's timers could pair a push
  with the wrong timer.
- **Restore replaces, never merges.** Merging would need a rule per store for
  records present on both sides (and the exercise-name uniqueness would clash);
  replacing is simple to reason about and matches "put my data back".
- **Validate before anything is written** (`parseBackup`, pure): the file
  must be JSON with the right `format`; `formatVersion` and `schemaVersion`
  must be whole numbers; newer ones than the app reads are rejected with
  "made by a newer version of the app … update the app"; every store must be a
  list and every record must have the fields its type requires (ids non-empty
  strings, numbers finite, settings unit `kg`/`lb`, template sets nested), with
  no repeated id in a store and no two exercises sharing a `nameKey` (the
  unique index). The first problem is reported as "Workout record 3:
  startedAt must be a number." Unknown extra fields are kept as stored.
- **Older schema versions migrate**, one small step per version
  (`MIGRATIONS[n]` turns version n into n+1). Version 1 had only restTimers,
  which backups do not carry, so a version-1 backup migrates to empty stores.
  A version with no step (below 1) is rejected. A test pins
  `BACKUP_SCHEMA_VERSION` to `WorkoutDB.verno`, so a schema bump fails until a
  backup migration is added.
- **Preview, then an explicit confirm.** The preview shows each store's count
  in the backup against what is stored now, says the restore REPLACES all
  data, names the workout in progress that will be lost, and warns when the
  backup is empty. Only "Replace all data with this backup" writes.
- **One transaction.** `restoreBackup` clears every carried store and
  `bulkAdd`s the file's records inside a single read-write Dexie transaction;
  if any write fails, the transaction aborts and the data stored before is
  left exactly as it was (tested).
- **Persistent storage first**, as for the Strong import (ADR-0008):
  `navigator.storage.persist()` is asked before the write; the answer does not
  block it. Settings shows whether storage is persistent (`persisted()`).
- **Saving the file.** When `navigator.canShare({ files })` is true (iOS
  Safari) the file goes to the share sheet; otherwise an `<a download>` blob
  link. Cancelling the sheet records nothing. If the share sheet refuses
  because the tap's activation expired while the file was built, a "Save
  backup file" button shares the ready file from a fresh tap.
- **Last backup.** `Settings.lastBackupAt` (optional, not indexed — no schema
  version) is set after the file is shared or downloaded, and after a restore
  to the restored file's `exportedAt` unless a later time is recorded. Settings
  shows it and nudges when there is none or it is over 30 days old.

## Consequences

- A restore loses anything logged since the backup, including a workout in
  progress; the preview says so, but there is no undo. Backing up right before
  restoring is up to the lifter.
- A download cannot be confirmed, so "last backup" may be recorded for a file
  the browser failed to save.
- The restored settings record carries the file's own `lastBackupAt`, then is
  moved forward to `exportedAt`; the round trip of every record is otherwise
  exact.
- The file is read and the whole backup held in memory; a very large history
  may need streaming later. The file is plain JSON, unencrypted: whoever holds
  it can read the training log.
- Records referring to missing ones (a set whose workout exercise is absent)
  are not rejected; files written by this app are consistent.
