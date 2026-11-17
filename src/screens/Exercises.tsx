import { useId, useState } from "react";
import { ExerciseAttributesFields } from "../components/ExerciseAttributesFields";
import { ExerciseList } from "../components/ExerciseList";
import { ExerciseMeasureField } from "../components/ExerciseMeasureField";
import { ExerciseNameForm } from "../components/ExerciseNameForm";
import { ExerciseRestField } from "../components/ExerciseRestField";
import type { ExerciseNameResult } from "../db";
import { DEFAULT_SET_MEASURE } from "../db/constants";
import type { Exercise, SetMeasure } from "../db/types";
import { resolveMeasure } from "../db/workoutLog";
import {
	exerciseLibraryActions,
	useArchivedExercises,
	useLibraryExercises,
} from "../hooks/useLibraryExercises";
import { useSettings } from "../hooks/useSettings";
import { describeExerciseNameError } from "../lib/exerciseLibrary";

function buildExerciseNameMessage(result: ExerciseNameResult): string | null {
	return result.ok ? null : describeExerciseNameError(result);
}

/**
 * The Exercises tab: search, add, rename, remove and restore exercises, and
 * edit their measure, rest and attributes.
 */
export function Exercises() {
	const searchId = useId();
	const [query, setQuery] = useState("");
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	/** What the next exercise added will log. */
	const [newMeasure, setNewMeasure] = useState<SetMeasure>(DEFAULT_SET_MEASURE);
	const exercises = useLibraryExercises(query);
	const archived = useArchivedExercises();
	const { settings } = useSettings();

	async function create(name: string) {
		const result = await exerciseLibraryActions.create(name, newMeasure);
		if (result.ok) {
			setNotice(`Added “${result.exercise.name}”.`);
			setNewMeasure(DEFAULT_SET_MEASURE);
		}
		return buildExerciseNameMessage(result);
	}

	async function rename(exercise: Exercise, name: string) {
		const result = await exerciseLibraryActions.rename(exercise.id, name);
		if (result.ok) {
			setNotice(`Renamed to “${result.exercise.name}”.`);
			setExpandedId(null);
		}
		return buildExerciseNameMessage(result);
	}

	async function changeMeasure(exercise: Exercise, measure: SetMeasure) {
		let saved = false;
		try {
			saved = await exerciseLibraryActions.setMeasure(exercise.id, measure);
		} catch {
			saved = false;
		}
		setNotice(
			saved ? null : `Could not change what “${exercise.name}” records.`,
		);
	}

	async function remove(exercise: Exercise) {
		if (!window.confirm(`Remove “${exercise.name}” from your library?`)) {
			return;
		}
		const outcome = await exerciseLibraryActions.remove(exercise.id);
		setExpandedId(null);
		setNotice(
			outcome === "archived"
				? `Archived “${exercise.name}”: your history still uses it.`
				: `Deleted “${exercise.name}”.`,
		);
	}

	async function restore(exercise: Exercise) {
		if (await exerciseLibraryActions.restore(exercise.id)) {
			setNotice(`Restored “${exercise.name}”.`);
		}
	}

	return (
		<>
			<header className="head">
				<h1>Exercises</h1>
			</header>

			<ExerciseNameForm
				label="Add exercise"
				submitLabel="Add"
				clearOnSuccess
				onSubmit={create}
			/>
			<ExerciseMeasureField measure={newMeasure} onChange={setNewMeasure} />

			{notice !== null && (
				<p className="notice" role="status">
					{notice}
				</p>
			)}

			<section aria-labelledby="library" className="library">
				<h2 id="library">Library</h2>
				<label htmlFor={searchId} className="visually-hidden">
					Search exercises
				</label>
				<input
					id={searchId}
					className="text-input"
					type="search"
					placeholder="Search by name"
					autoComplete="off"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
				{exercises && (
					<ExerciseList
						exercises={exercises}
						empty={
							query.trim() === ""
								? "No exercises yet. Add one above."
								: "No exercise matches that name."
						}
						expandedId={expandedId}
						onSelect={(exercise) =>
							setExpandedId(expandedId === exercise.id ? null : exercise.id)
						}
						renderExpanded={(exercise) => (
							<div className="exercise-edit">
								<ExerciseNameForm
									key={exercise.id}
									label="Rename"
									submitLabel="Save"
									initialName={exercise.name}
									onSubmit={(name) => rename(exercise, name)}
								/>
								<ExerciseMeasureField
									measure={resolveMeasure(exercise)}
									onChange={(measure) => void changeMeasure(exercise, measure)}
									hint="Sets already logged keep their values; this changes which are shown."
								/>
								<ExerciseRestField
									key={`${exercise.id}-rest`}
									restSeconds={exercise.restSeconds}
									defaultSeconds={settings.restSeconds}
									onSave={(seconds) =>
										void exerciseLibraryActions.setRest(exercise.id, seconds)
									}
								/>
								<ExerciseAttributesFields
									attributes={exercise}
									onEdit={(edit) =>
										void exerciseLibraryActions.editAttributes(
											exercise.id,
											edit,
										)
									}
								/>
								<button
									type="button"
									className="danger"
									onClick={() => remove(exercise)}
								>
									Remove
								</button>
								<p className="hint">
									An exercise your workouts or templates use is archived instead
									of deleted, so your history keeps it.
								</p>
							</div>
						)}
					/>
				)}
			</section>

			{archived && archived.length > 0 && (
				<details className="archived">
					<summary>Archived ({archived.length})</summary>
					<ul className="exercise-list">
						{archived.map((exercise) => (
							<li key={exercise.id} className="archived-row">
								<span>{exercise.name}</span>
								<button
									type="button"
									className="chip"
									onClick={() => restore(exercise)}
								>
									Restore
								</button>
							</li>
						))}
					</ul>
				</details>
			)}
		</>
	);
}
