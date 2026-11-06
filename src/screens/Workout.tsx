import { type ReactNode, useState } from "react";
import { ActiveWorkout } from "../components/workout/ActiveWorkout";
import { ExercisePicker } from "../components/workout/ExercisePicker";
import { PreviousSet } from "../components/workout/PreviousSet";
import type { Exercise, WeightUnit, WorkoutSet } from "../db/types";
import type { CompletedSet } from "../db/workoutLog";
import {
	type ActiveWorkoutView,
	useActiveWorkout,
	workoutLogActions,
} from "../hooks/useActiveWorkout";
import {
	exerciseLibraryActions,
	useLibraryExercises,
} from "../hooks/useLibraryExercises";
import { usePreviousSets } from "../hooks/usePreviousSets";
import { useSettings } from "../hooks/useSettings";
import { describeExerciseNameError } from "../lib/exerciseLibrary";
import { formatPreviousSet, planFillFromPrevious } from "../lib/previousSets";

type WorkoutProps = {
	/**
	 * Called after a set is marked done and saved, with the set and its
	 * exercise; the rest timer (#29) starts from here.
	 */
	onSetCompleted?: (completed: CompletedSet) => void;
};

/**
 * The Workout tab: start a workout, then log it. Every edit is saved to the
 * device as it happens, so reopening the app resumes the workout.
 */
export function Workout({ onSetCompleted }: WorkoutProps) {
	const active = useActiveWorkout();
	const { settings } = useSettings();
	const [notice, setNotice] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	/** Runs a write, showing its error instead of losing it. */
	function run(write: () => Promise<unknown>) {
		setError(null);
		write().catch((err: unknown) =>
			setError(err instanceof Error ? err.message : String(err)),
		);
	}

	const messages = (
		<>
			{notice !== null && (
				<p className="notice" role="status">
					{notice}
				</p>
			)}
			{error !== null && (
				<p className="error" role="alert">
					Could not save: {error}
				</p>
			)}
		</>
	);

	if (active === undefined) return null;

	if (active === null) {
		return (
			<>
				<header className="head">
					<h1>Workout</h1>
					<p className="lead">
						Start a workout and log your sets. Everything is saved on this
						device as you go.
					</p>
				</header>
				{messages}
				<button
					type="button"
					className="primary"
					onClick={() =>
						run(async () => {
							setNotice(null);
							await workoutLogActions.start();
						})
					}
				>
					Start an empty workout
				</button>
			</>
		);
	}

	return (
		<LogWorkout
			view={active}
			weightUnit={settings.weightUnit}
			messages={messages}
			run={run}
			onSetCompleted={onSetCompleted}
			onFinished={(name) => setNotice(`Saved “${name}”.`)}
			onDiscarded={() => setNotice("Workout discarded.")}
		/>
	);
}

type LogWorkoutProps = {
	view: ActiveWorkoutView;
	weightUnit: WeightUnit;
	messages: ReactNode;
	run: (write: () => Promise<unknown>) => void;
	onSetCompleted?: ((completed: CompletedSet) => void) | undefined;
	onFinished: (name: string) => void;
	onDiscarded: () => void;
};

function LogWorkout({
	view,
	weightUnit,
	messages,
	run,
	onSetCompleted,
	onFinished,
	onDiscarded,
}: LogWorkoutProps) {
	const [picking, setPicking] = useState(false);
	const [query, setQuery] = useState("");
	const library = useLibraryExercises(query);
	const previous = usePreviousSets(
		view.detail.exercises.map((e) => e.workoutExercise.exerciseId),
	);
	const { workout } = view.detail;

	function closePicker() {
		setPicking(false);
		setQuery("");
	}

	function pick(exercise: Exercise) {
		run(() => workoutLogActions.addExercise(workout.id, exercise.id));
		closePicker();
	}

	async function createAndPick(name: string): Promise<string | null> {
		const result = await exerciseLibraryActions.create(name);
		if (!result.ok) return describeExerciseNameError(result);
		pick(result.exercise);
		return null;
	}

	function toggleDone(set: WorkoutSet) {
		if (set.completedAt !== undefined) {
			run(() => workoutLogActions.uncompleteSet(set.id));
			return;
		}
		run(async () => {
			const completed = await workoutLogActions.completeSet(set.id);
			if (completed) onSetCompleted?.(completed);
		});
	}

	if (picking) {
		return (
			<ExercisePicker
				exercises={library}
				query={query}
				onQueryChange={setQuery}
				onPick={pick}
				onCreate={createAndPick}
				onCancel={closePicker}
			/>
		);
	}

	return (
		<>
			{messages}
			<ActiveWorkout
				detail={view.detail}
				exercises={view.exercises}
				weightUnit={weightUnit}
				renderPrevious={(exerciseId, setIndex, set) => {
					const last = previous?.get(exerciseId)?.[setIndex];
					const name = view.exercises.get(exerciseId)?.name ?? "Exercise";
					return (
						<PreviousSet
							text={last && formatPreviousSet(last, weightUnit)}
							setLabel={`${name} set ${setIndex + 1}`}
							onFill={() => {
								if (!last) return;
								const changes = planFillFromPrevious(last);
								run(() => workoutLogActions.updateSet(set.id, changes));
							}}
						/>
					);
				}}
				onRename={(name) =>
					run(() => workoutLogActions.update(workout.id, { name }))
				}
				onNotesChange={(notes) =>
					run(() => workoutLogActions.update(workout.id, { notes }))
				}
				onAddExercise={() => setPicking(true)}
				onMoveExercise={(id, toIndex) =>
					run(() => workoutLogActions.moveExercise(id, toIndex))
				}
				onRemoveExercise={(id, name) => {
					if (
						window.confirm(`Remove ${name} and its sets from this workout?`)
					) {
						run(() => workoutLogActions.removeExercise(id));
					}
				}}
				onAddSet={(id) => run(() => workoutLogActions.addSet(id))}
				onSetChange={(id, changes) =>
					run(() => workoutLogActions.updateSet(id, changes))
				}
				onToggleSetDone={toggleDone}
				onRemoveSet={(id) => run(() => workoutLogActions.removeSet(id))}
				onFinish={() =>
					run(async () => {
						const finished = await workoutLogActions.finish(workout.id);
						if (finished) onFinished(finished.name);
					})
				}
				onDiscard={() => {
					if (
						window.confirm(
							"Discard this workout? Its exercises and sets will be deleted.",
						)
					) {
						run(async () => {
							if (await workoutLogActions.discard(workout.id)) onDiscarded();
						});
					}
				}}
			/>
		</>
	);
}
