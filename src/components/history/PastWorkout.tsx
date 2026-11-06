import { useId } from "react";
import type { WorkoutDetail } from "../../db";
import type { Exercise, WeightUnit, WorkoutSet } from "../../db/types";
import type { SetChanges } from "../../db/workoutLog";
import { useDraftField } from "../../hooks/useDraftField";
import {
	formatDuration,
	parseDateTimeLocal,
	toDateTimeLocal,
} from "../../lib/history";
import { HISTORY_PATH } from "../../lib/routes";
import { Link } from "../Link";
import { ExerciseCard } from "../workout/ExerciseCard";

type PastWorkoutProps = {
	detail: WorkoutDetail;
	exercises: ReadonlyMap<string, Exercise>;
	weightUnit: WeightUnit;
	/** Why the last start time typed was refused, if it was. */
	startError: string | null;
	onRename: (name: string) => void;
	onNotesChange: (notes: string) => void;
	onReschedule: (startedAt: number) => void;
	/** The start field lost focus: it shows the stored start again. */
	onStartBlur: () => void;
	onAddExercise: () => void;
	onMoveExercise: (workoutExerciseId: string, toIndex: number) => void;
	onRemoveExercise: (workoutExerciseId: string, name: string) => void;
	onAddSet: (workoutExerciseId: string) => void;
	onSetChange: (setId: string, changes: SetChanges) => void;
	onToggleSetDone: (set: WorkoutSet) => void;
	onRemoveSet: (setId: string) => void;
	onDelete: () => void;
};

/** A finished workout from History, editable: name, start, notes, exercises and sets, delete. */
export function PastWorkout({
	detail,
	exercises,
	weightUnit,
	startError,
	onRename,
	onNotesChange,
	onReschedule,
	onStartBlur,
	onAddExercise,
	onMoveExercise,
	onRemoveExercise,
	onAddSet,
	onSetChange,
	onToggleSetDone,
	onRemoveSet,
	onDelete,
}: PastWorkoutProps) {
	const id = useId();
	const { workout } = detail;
	const name = useDraftField(workout.name, onRename);
	const notes = useDraftField(workout.notes ?? "", onNotesChange);
	const storedStart = toDateTimeLocal(workout.startedAt);
	const start = useDraftField(storedStart, (text) => {
		const startedAt = parseDateTimeLocal(text);
		// Unchanged to the minute: keep the stored seconds.
		if (startedAt !== undefined && text !== storedStart) {
			onReschedule(startedAt);
		}
	});

	return (
		<>
			<Link to={HISTORY_PATH} className="back">
				‹ History
			</Link>
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
				{workout.endedAt !== undefined && (
					<p className="lead">
						Duration {formatDuration(workout.endedAt - workout.startedAt)}
					</p>
				)}
			</header>

			<div className="field">
				<label htmlFor={`${id}-start`}>Started</label>
				<input
					id={`${id}-start`}
					className="text-input"
					type="datetime-local"
					aria-invalid={startError !== null}
					aria-describedby={
						startError === null ? undefined : `${id}-start-error`
					}
					{...start}
					onBlur={() => {
						start.onBlur();
						onStartBlur();
					}}
				/>
				{startError !== null && (
					<p id={`${id}-start-error`} className="error" role="alert">
						{startError}
					</p>
				)}
			</div>

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
				<p className="empty">No exercises in this workout.</p>
			)}

			{detail.exercises.map((entry, index) => {
				const exerciseName =
					exercises.get(entry.workoutExercise.exerciseId)?.name ??
					"Unknown exercise";
				const workoutExerciseId = entry.workoutExercise.id;
				return (
					<ExerciseCard
						key={workoutExerciseId}
						entry={entry}
						name={exerciseName}
						index={index}
						count={detail.exercises.length}
						weightUnit={weightUnit}
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
				<button type="button" className="danger" onClick={onDelete}>
					Delete workout
				</button>
			</div>
		</>
	);
}
