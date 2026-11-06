import { useId, useState } from "react";
import { ExerciseList } from "../components/ExerciseList";
import { ExerciseNameForm } from "../components/ExerciseNameForm";
import type { ExerciseNameResult } from "../db";
import type { Exercise } from "../db/types";
import {
	exerciseLibraryActions,
	useArchivedExercises,
	useLibraryExercises,
} from "../hooks/useLibraryExercises";
import { describeExerciseNameError } from "../lib/exerciseLibrary";

function toFormMessage(result: ExerciseNameResult): string | null {
	return result.ok ? null : describeExerciseNameError(result);
}

/** The Exercises tab: search, add, rename, remove and restore exercises. */
export function Exercises() {
	const searchId = useId();
	const [query, setQuery] = useState("");
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const exercises = useLibraryExercises(query);
	const archived = useArchivedExercises();

	async function create(name: string) {
		const result = await exerciseLibraryActions.create(name);
		if (result.ok) setNotice(`Added “${result.exercise.name}”.`);
		return toFormMessage(result);
	}

	async function rename(exercise: Exercise, name: string) {
		const result = await exerciseLibraryActions.rename(exercise.id, name);
		if (result.ok) {
			setNotice(`Renamed to “${result.exercise.name}”.`);
			setExpandedId(null);
		}
		return toFormMessage(result);
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
