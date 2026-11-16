import type { ChangeEvent } from "react";
import type { ProgramImportPlan } from "../db/programImport";
import { useProgramImport } from "../hooks/useProgramImport";
import { describeMeasure } from "../lib/setMeasure";

function formatCount(count: number, singular: string, plural: string): string {
	return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

/** Settings → Import program: pick the JSON, preview, confirm. */
export function ProgramImport() {
	const { state, chooseFile, confirm, reset } = useProgramImport();

	function pick(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		// Clear it so choosing the same file again fires a change.
		e.target.value = "";
		if (file) chooseFile(file);
	}

	return (
		<div className="stack program-import">
			<p className="lead">
				Import a training program file as templates, one per week and day.
				Templates, exercises and workouts already here are kept as they are.
			</p>
			{state.step === "idle" && (
				<label className="secondary file-pick">
					Import program
					<input
						type="file"
						accept=".json,application/json"
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
			{state.step === "invalid" && (
				<>
					<p className="error" role="alert">
						This program file cannot be imported. Fix these problems and try
						again:
					</p>
					<ul className="import-list program-errors">
						{state.errors.map((error) => (
							<li key={error}>{error}</li>
						))}
					</ul>
					<button type="button" className="secondary" onClick={reset}>
						Try another file
					</button>
				</>
			)}
			{state.step === "preview" && (
				<ProgramPreview
					plan={state.plan}
					onConfirm={() => confirm(state.program)}
					onCancel={reset}
				/>
			)}
			{state.step === "done" && (
				<>
					<p className="notice" role="status">
						Added {formatCount(state.templatesCreated, "template", "templates")}{" "}
						and created{" "}
						{formatCount(state.exercisesCreated, "exercise", "exercises")}.
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

type ProgramPreviewProps = {
	plan: ProgramImportPlan;
	onConfirm: () => void;
	onCancel: () => void;
};

/** What the import would add; nothing is written until Confirm. */
function ProgramPreview({ plan, onConfirm, onCancel }: ProgramPreviewProps) {
	const refused =
		plan.alreadyImportedBlocks.length > 0 || plan.setErrors.length > 0;
	return (
		<div className="stack">
			<p className="lead">
				“{plan.programName}”, block{plan.blocks.length === 1 ? "" : "s"}{" "}
				{plan.blocks.join(", ")}.
			</p>
			<ul className="checks import-summary">
				<li>
					{formatCount(plan.templates.length, "template", "templates")} to add
				</li>
				<li>
					{formatCount(plan.matchedExerciseCount, "exercise", "exercises")}{" "}
					already in your library
				</li>
				{plan.measureMismatches.map((mismatch) => (
					<li key={mismatch.name} className="warn">
						“{mismatch.name}” is logged as{" "}
						{describeMeasure(mismatch.libraryMeasure).toLowerCase()} here; the
						file says {describeMeasure(mismatch.fileMeasure).toLowerCase()}.
						Your library's measure is kept.
					</li>
				))}
			</ul>
			{plan.newExercises.length > 0 && (
				<details className="import-details">
					<summary>
						{formatCount(
							plan.newExercises.length,
							"new exercise",
							"new exercises",
						)}
					</summary>
					<ul className="import-list">
						{plan.newExercises.map((exercise) => (
							<li key={exercise.name}>
								{exercise.name} ({describeMeasure(exercise.measure)})
							</li>
						))}
					</ul>
				</details>
			)}
			<details className="import-details">
				<summary>Templates</summary>
				<ul className="import-list">
					{plan.templates.map((template) => (
						<li
							key={`${template.program.block}-${template.program.week}-${template.program.day}`}
						>
							{template.name}
						</li>
					))}
				</ul>
			</details>
			{plan.setErrors.length > 0 && (
				<>
					<p className="error" role="alert">
						Some planned sets use fields the exercise's measure in your library
						does not, so their values would be lost. Fix these in the file and
						try again:
					</p>
					<ul className="import-list program-errors">
						{plan.setErrors.map((error) => (
							<li key={error}>{error}</li>
						))}
					</ul>
				</>
			)}
			{plan.alreadyImportedBlocks.length > 0 && (
				<p className="error" role="alert">
					Block {plan.alreadyImportedBlocks.join(", ")} of this program is
					already imported. Delete its templates first, or give the file a new
					block number or programId.
				</p>
			)}
			{refused ? null : (
				<button type="button" className="primary" onClick={onConfirm}>
					Add {formatCount(plan.templates.length, "template", "templates")}
				</button>
			)}
			<button type="button" className="secondary" onClick={onCancel}>
				Cancel
			</button>
		</div>
	);
}
