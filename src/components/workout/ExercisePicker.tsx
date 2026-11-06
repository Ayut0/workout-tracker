import { useId, useState } from "react";
import type { Exercise } from "../../db/types";
import { ExerciseList } from "../ExerciseList";
import { ExerciseNameForm } from "../ExerciseNameForm";

type ExercisePickerProps = {
	/** Library exercises matching the query; undefined while loading. */
	exercises: Exercise[] | undefined;
	query: string;
	onQueryChange: (query: string) => void;
	onPick: (exercise: Exercise) => void;
	/** Creates a new exercise and adds it; resolves to an error message, or null. */
	onCreate: (name: string) => Promise<string | null>;
	onCancel: () => void;
};

/** Picks an exercise to add to the workout, or creates a new one. */
export function ExercisePicker({
	exercises,
	query,
	onQueryChange,
	onPick,
	onCreate,
	onCancel,
}: ExercisePickerProps) {
	const searchId = useId();
	const [creating, setCreating] = useState(false);
	return (
		<section className="picker" aria-labelledby={`${searchId}-title`}>
			<div className="picker-head">
				<h1 id={`${searchId}-title`}>Add exercise</h1>
				<button type="button" className="chip" onClick={onCancel}>
					Cancel
				</button>
			</div>
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
				onChange={(e) => onQueryChange(e.target.value)}
			/>
			{creating ? (
				<ExerciseNameForm
					label="New exercise"
					submitLabel="Add"
					initialName={query}
					onSubmit={onCreate}
				/>
			) : (
				<button
					type="button"
					className="secondary"
					onClick={() => setCreating(true)}
				>
					New exercise
				</button>
			)}
			{exercises && (
				<ExerciseList
					exercises={exercises}
					onSelect={onPick}
					empty={
						query.trim() === ""
							? "Your library is empty. Create an exercise above."
							: "No exercise matches that name."
					}
				/>
			)}
		</section>
	);
}
