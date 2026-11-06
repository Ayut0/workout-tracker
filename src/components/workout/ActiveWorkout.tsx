import { type ReactNode, useId } from "react";
import type { WorkoutDetail } from "../../db";
import type { Exercise, WeightUnit, WorkoutSet } from "../../db/types";
import type { SetChanges } from "../../db/workoutLog";
import { useDraftField } from "../../hooks/useDraftField";
import { useNow } from "../../hooks/useNow";
import { formatElapsed } from "../../lib/workoutLog";
import { ExerciseCard } from "./ExerciseCard";

const CLOCK_TICK_MS = 1_000;

type ActiveWorkoutProps = {
	detail: WorkoutDetail;
	exercises: ReadonlyMap<string, Exercise>;
	weightUnit: WeightUnit;
	/** The Previous column for an exercise's set (#28); omit to hide it. */
	renderPrevious?: (exerciseId: string, setIndex: number) => ReactNode;
	onRename: (name: string) => void;
	onNotesChange: (notes: string) => void;
	onAddExercise: () => void;
	onMoveExercise: (workoutExerciseId: string, toIndex: number) => void;
	onRemoveExercise: (workoutExerciseId: string, name: string) => void;
	onAddSet: (workoutExerciseId: string) => void;
	onSetChange: (setId: string, changes: SetChanges) => void;
	onToggleSetDone: (set: WorkoutSet) => void;
	onRemoveSet: (setId: string) => void;
	onFinish: () => void;
	onDiscard: () => void;
};

/** The workout in progress: name, time, notes, exercises with sets, finish and discard. */
export function ActiveWorkout({
	detail,
	exercises,
	weightUnit,
	renderPrevious,
	onRename,
	onNotesChange,
	onAddExercise,
	onMoveExercise,
	onRemoveExercise,
	onAddSet,
	onSetChange,
	onToggleSetDone,
	onRemoveSet,
	onFinish,
	onDiscard,
}: ActiveWorkoutProps) {
	const id = useId();
	const { workout } = detail;
	const name = useDraftField(workout.name, onRename);
	const notes = useDraftField(workout.notes ?? "", onNotesChange);

	return (
		<>
			<header className="workout-head">
				<label htmlFor={`${id}-name`} className="visually-hidden">
					Workout name
				</label>
				<input
					id={`${id}-name`}
					className="workout-name"
					type="text"
					autoComplete="off"
					autoCapitalize="sentences"
					enterKeyHint="done"
					{...name}
				/>
				<p className="lead">
					Started{" "}
					{new Date(workout.startedAt).toLocaleTimeString([], {
						hour: "numeric",
						minute: "2-digit",
					})}{" "}
					· <Elapsed since={workout.startedAt} />
				</p>
			</header>

			<div className="field">
				<label htmlFor={`${id}-notes`}>Notes</label>
				<textarea
					id={`${id}-notes`}
					className="text-input notes-input"
					rows={2}
					{...notes}
				/>
			</div>

			{detail.exercises.length === 0 && (
				<p className="empty">No exercises yet. Add one to log your sets.</p>
			)}

			{detail.exercises.map((entry, index) => {
				const exerciseId = entry.workoutExercise.exerciseId;
				const exerciseName =
					exercises.get(exerciseId)?.name ?? "Unknown exercise";
				const workoutExerciseId = entry.workoutExercise.id;
				return (
					<ExerciseCard
						key={workoutExerciseId}
						entry={entry}
						name={exerciseName}
						index={index}
						count={detail.exercises.length}
						weightUnit={weightUnit}
						renderPrevious={
							renderPrevious &&
							((setIndex) => renderPrevious(exerciseId, setIndex))
						}
						onMove={(toIndex) => onMoveExercise(workoutExerciseId, toIndex)}
						onRemove={() => onRemoveExercise(workoutExerciseId, exerciseName)}
						onAddSet={() => onAddSet(workoutExerciseId)}
						onSetChange={onSetChange}
						onToggleSetDone={onToggleSetDone}
						onRemoveSet={onRemoveSet}
					/>
				);
			})}

			<button type="button" className="secondary" onClick={onAddExercise}>
				Add exercise
			</button>

			<div className="workout-actions">
				<button type="button" className="primary" onClick={onFinish}>
					Finish workout
				</button>
				<button type="button" className="danger" onClick={onDiscard}>
					Discard workout
				</button>
			</div>
		</>
	);
}

/** Time since the workout started, ticking every second. */
function Elapsed({ since }: { since: number }) {
	const now = useNow(CLOCK_TICK_MS);
	return (
		<span className="elapsed">
			<span className="visually-hidden">Duration </span>
			{formatElapsed(now - since)}
		</span>
	);
}
