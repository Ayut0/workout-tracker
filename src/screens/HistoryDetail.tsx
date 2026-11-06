import { useState } from "react";
import { PastWorkout } from "../components/history/PastWorkout";
import { Link } from "../components/Link";
import { ExercisePicker } from "../components/workout/ExercisePicker";
import type { Exercise, WorkoutSet } from "../db/types";
import { workoutLogActions } from "../hooks/useActiveWorkout";
import {
	exerciseLibraryActions,
	useLibraryExercises,
} from "../hooks/useLibraryExercises";
import { useSettings } from "../hooks/useSettings";
import {
	historyActions,
	useWorkoutDetail,
	type WorkoutDetailView,
} from "../hooks/useWorkoutHistory";
import { describeExerciseNameError } from "../lib/exerciseLibrary";
import { describeRescheduleError } from "../lib/history";
import { navigate } from "../lib/navigation";
import { HISTORY_PATH } from "../lib/routes";

/**
 * One past workout from History: its exercises and sets, edited in place and
 * saved as typed, and deleted after a confirmation.
 */
export function HistoryDetail({ workoutId }: { workoutId: string }) {
	const view = useWorkoutDetail(workoutId);
	if (view === undefined) return null;
	if (view === null) {
		return (
			<>
				<Link to={HISTORY_PATH} className="back">
					‹ History
				</Link>
				<header className="head">
					<h1>Workout not found</h1>
					<p className="lead">It may have been deleted.</p>
				</header>
			</>
		);
	}
	if (view.detail.workout.endedAt === undefined) {
		return (
			<>
				<Link to={HISTORY_PATH} className="back">
					‹ History
				</Link>
				<header className="head">
					<h1>{view.detail.workout.name}</h1>
					<p className="lead">
						This workout is in progress.{" "}
						<Link to="/">Open the Workout tab</Link> to log it.
					</p>
				</header>
			</>
		);
	}
	return <EditPastWorkout view={view} />;
}

function EditPastWorkout({ view }: { view: WorkoutDetailView }) {
	const { settings } = useSettings();
	const [picking, setPicking] = useState(false);
	const [query, setQuery] = useState("");
	const library = useLibraryExercises(query);
	const [error, setError] = useState<string | null>(null);
	const [startError, setStartError] = useState<string | null>(null);
	const { workout } = view.detail;
	const endedAt = workout.endedAt ?? workout.startedAt;

	/** Runs a write, showing its error instead of losing it. */
	function run(write: () => Promise<unknown>) {
		setError(null);
		write().catch((err: unknown) =>
			setError(err instanceof Error ? err.message : String(err)),
		);
	}

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
		run(() =>
			set.completedAt === undefined
				? historyActions.completeSet(set.id, endedAt)
				: workoutLogActions.uncompleteSet(set.id),
		);
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
			{error !== null && (
				<p className="error" role="alert">
					Could not save: {error}
				</p>
			)}
			<PastWorkout
				detail={view.detail}
				exercises={view.exercises}
				weightUnit={settings.weightUnit}
				startError={startError}
				onRename={(name) =>
					run(() => workoutLogActions.update(workout.id, { name }))
				}
				onNotesChange={(notes) =>
					run(() => workoutLogActions.update(workout.id, { notes }))
				}
				onReschedule={(startedAt) =>
					run(async () => {
						const result = await historyActions.reschedule(
							workout.id,
							startedAt,
						);
						setStartError(result.ok ? null : describeRescheduleError(result));
					})
				}
				onStartBlur={() => setStartError(null)}
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
				onDelete={() => {
					if (
						window.confirm(
							`Delete “${workout.name}”? Its exercises and sets will be deleted. This cannot be undone.`,
						)
					) {
						run(async () => {
							await historyActions.delete(workout.id);
							navigate(HISTORY_PATH, { replace: true });
						});
					}
				}}
			/>
		</>
	);
}
