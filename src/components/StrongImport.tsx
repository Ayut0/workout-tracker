import { type ChangeEvent, type FormEvent, useState } from "react";
import type { StrongImportPlan } from "../db/strongImport";
import type { WeightUnit } from "../db/types";
import { useSettings } from "../hooks/useSettings";
import { useStrongImport } from "../hooks/useStrongImport";
import type { DistanceUnit, UnitKind } from "../lib/strongCsv";

const WEIGHT_UNITS: { unit: WeightUnit; label: string }[] = [
	{ unit: "kg", label: "kg" },
	{ unit: "lb", label: "lb" },
];

const DISTANCE_UNITS: { unit: DistanceUnit; label: string }[] = [
	{ unit: "km", label: "km" },
	{ unit: "mi", label: "miles" },
	{ unit: "m", label: "metres" },
];

function formatCount(count: number, singular: string, plural: string): string {
	return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function formatDate(epochMs: number): string {
	return new Date(epochMs).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

/** Settings → Import from Strong: pick the CSV, preview, confirm. */
export function StrongImport() {
	const { state, chooseFile, chooseUnits, confirm, reset } = useStrongImport();

	function pick(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		// Clear it so choosing the same file again fires a change.
		e.target.value = "";
		if (file) chooseFile(file);
	}

	return (
		<div className="stack strong-import">
			<p className="lead">
				Import your history from a Strong CSV export. Workouts already here are
				kept as they are; importing the same file twice adds nothing.
			</p>
			{state.step === "idle" && (
				<label className="secondary file-pick">
					Import from Strong
					<input
						type="file"
						accept=".csv,text/csv"
						className="visually-hidden"
						onChange={pick}
					/>
				</label>
			)}
			{state.step === "busy" && (
				<p className="lead" role="status">
					{state.message}
				</p>
			)}
			{state.step === "needsUnits" && (
				<UnitsForm
					missing={state.missing}
					onSubmit={(units) => chooseUnits(state.text, units)}
					onCancel={reset}
				/>
			)}
			{state.step === "preview" && (
				<ImportPreview
					plan={state.plan}
					onConfirm={() => confirm(state.plan)}
					onCancel={reset}
				/>
			)}
			{state.step === "done" && (
				<>
					<p className="notice" role="status">
						Imported{" "}
						{formatCount(state.result.workoutsAdded, "workout", "workouts")} (
						{formatCount(state.result.setsAdded, "set", "sets")}) and created{" "}
						{formatCount(
							state.result.exercisesCreated,
							"exercise",
							"exercises",
						)}
						.
						{state.result.duplicateCount > 0 &&
							` Skipped ${formatCount(state.result.duplicateCount, "workout", "workouts")} already here.`}
					</p>
					<button type="button" className="secondary" onClick={reset}>
						Done
					</button>
				</>
			)}
			{state.step === "error" && (
				<>
					<p className="error" role="alert">
						Could not import: {state.message}
					</p>
					<button type="button" className="secondary" onClick={reset}>
						Try another file
					</button>
				</>
			)}
		</div>
	);
}

type UnitsFormProps = {
	missing: UnitKind[];
	onSubmit: (units: {
		weightUnit?: WeightUnit;
		distanceUnit?: DistanceUnit;
	}) => void;
	onCancel: () => void;
};

/** Asks for the units the export does not state. */
function UnitsForm({ missing, onSubmit, onCancel }: UnitsFormProps) {
	const { settings } = useSettings();
	const [weightUnit, setWeightUnit] = useState<WeightUnit | null>(null);
	const [distanceUnit, setDistanceUnit] = useState<DistanceUnit | null>(null);
	const needsWeight = missing.includes("weight");
	const needsDistance = missing.includes("distance");
	const chosenWeight = weightUnit ?? settings.weightUnit;
	const ready = !needsDistance || distanceUnit !== null;

	function submit(e: FormEvent) {
		e.preventDefault();
		if (!ready) return;
		onSubmit({
			...(needsWeight ? { weightUnit: chosenWeight } : {}),
			...(needsDistance && distanceUnit ? { distanceUnit } : {}),
		});
	}

	return (
		<form className="stack" onSubmit={submit}>
			<p className="lead">
				The export does not say which units it uses. Pick the ones you used in
				Strong.
			</p>
			{needsWeight && (
				<fieldset className="segmented">
					<legend>Weight unit</legend>
					{WEIGHT_UNITS.map(({ unit, label }) => (
						<button
							key={unit}
							type="button"
							className={unit === chosenWeight ? "chip on" : "chip"}
							aria-pressed={unit === chosenWeight}
							onClick={() => setWeightUnit(unit)}
						>
							{label}
						</button>
					))}
				</fieldset>
			)}
			{needsDistance && (
				<fieldset className="segmented">
					<legend>Distance unit</legend>
					{DISTANCE_UNITS.map(({ unit, label }) => (
						<button
							key={unit}
							type="button"
							className={unit === distanceUnit ? "chip on" : "chip"}
							aria-pressed={unit === distanceUnit}
							onClick={() => setDistanceUnit(unit)}
						>
							{label}
						</button>
					))}
				</fieldset>
			)}
			<button type="submit" className="primary" disabled={!ready}>
				Continue
			</button>
			<button type="button" className="secondary" onClick={onCancel}>
				Cancel
			</button>
		</form>
	);
}

type ImportPreviewProps = {
	plan: StrongImportPlan;
	onConfirm: () => void;
	onCancel: () => void;
};

/** What the import would add; nothing is written until Confirm. */
function ImportPreview({ plan, onConfirm, onCancel }: ImportPreviewProps) {
	const hasNew = plan.workouts.length > 0;
	return (
		<div className="stack">
			<ul className="checks import-summary">
				<li>
					{formatCount(plan.workouts.length, "workout", "workouts")} to import
					{hasNew && ` (${formatCount(plan.setCount, "set", "sets")})`}
				</li>
				{plan.firstStartedAt !== undefined &&
					plan.lastStartedAt !== undefined && (
						<li>
							{formatDate(plan.firstStartedAt)} –{" "}
							{formatDate(plan.lastStartedAt)}
						</li>
					)}
				{plan.duplicateCount > 0 && (
					<li>
						{formatCount(plan.duplicateCount, "workout", "workouts")} already
						here, skipped
					</li>
				)}
			</ul>
			{plan.newExerciseNames.length > 0 && (
				<details className="import-details">
					<summary>
						{formatCount(
							plan.newExerciseNames.length,
							"new exercise",
							"new exercises",
						)}
					</summary>
					<ul className="import-list">
						{plan.newExerciseNames.map((name) => (
							<li key={name}>{name}</li>
						))}
					</ul>
				</details>
			)}
			{plan.skipped.length > 0 && (
				<details className="import-details">
					<summary>
						{formatCount(plan.skipped.length, "row", "rows")} skipped
					</summary>
					<ul className="import-list">
						{plan.skipped.map((row) => (
							<li key={row.line}>
								Line {row.line}: {row.reason}
							</li>
						))}
					</ul>
				</details>
			)}
			{hasNew ? (
				<button type="button" className="primary" onClick={onConfirm}>
					Import {formatCount(plan.workouts.length, "workout", "workouts")}
				</button>
			) : (
				<p className="lead">Nothing new to import.</p>
			)}
			<button type="button" className="secondary" onClick={onCancel}>
				Cancel
			</button>
		</div>
	);
}
