import { useId, useState } from "react";
import { Link } from "../components/Link";
import { TemplateExerciseCard } from "../components/templates/TemplateExerciseCard";
import { ExercisePicker } from "../components/workout/ExercisePicker";
import type { TemplateInput } from "../db/templates";
import type { Exercise } from "../db/types";
import {
	exerciseLibraryActions,
	useLibraryExercises,
} from "../hooks/useLibraryExercises";
import { useSettings } from "../hooks/useSettings";
import {
	templateActions,
	useExercisesById,
	useTemplate,
} from "../hooks/useTemplates";
import { describeExerciseNameError } from "../lib/exerciseLibrary";
import { navigate } from "../lib/navigation";
import {
	appendPlannedSet,
	appendTemplateExercise,
	moveTemplateExercise,
	removePlannedSet,
	removeTemplateExercise,
	updatePlannedSet,
} from "../lib/templates";

/** Where the editor returns to: the Workout tab, which lists templates. */
const WORKOUT_PATH = "/";

const EMPTY_TEMPLATE: TemplateInput = { name: "", exercises: [] };

type TemplateEditorProps = {
	/** The template to edit; omitted for a new one. */
	templateId?: string;
};

/**
 * Creates or edits a template: name, exercises in order and planned sets.
 * Changes are a draft until Save, so Cancel leaves the template as it was.
 */
export function TemplateEditor({ templateId }: TemplateEditorProps) {
	if (templateId === undefined) {
		return <TemplateForm initial={EMPTY_TEMPLATE} />;
	}
	return <ExistingTemplateEditor templateId={templateId} />;
}

function ExistingTemplateEditor({ templateId }: { templateId: string }) {
	const template = useTemplate(templateId);
	if (template === undefined) return null;
	if (template === null) {
		return (
			<>
				<header className="head">
					<h1>Template not found</h1>
					<p className="lead">It may have been deleted.</p>
				</header>
				<Link to={WORKOUT_PATH}>Back to Workout</Link>
			</>
		);
	}
	return <TemplateForm templateId={templateId} initial={template} />;
}

type TemplateFormProps = {
	/** Set when editing a saved template; a new one has none yet. */
	templateId?: string;
	initial: TemplateInput;
};

function TemplateForm({ templateId, initial }: TemplateFormProps) {
	const id = useId();
	const { settings } = useSettings();
	const exercisesById = useExercisesById();
	const [name, setName] = useState(initial.name);
	const [exercises, setExercises] = useState(initial.exercises);
	const [picking, setPicking] = useState(false);
	const [query, setQuery] = useState("");
	const library = useLibraryExercises(query);
	const [error, setError] = useState<string | null>(null);

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
		setExercises((current) => appendTemplateExercise(current, exercise.id));
		closePicker();
	}

	async function createAndPick(exerciseName: string): Promise<string | null> {
		const result = await exerciseLibraryActions.create(exerciseName);
		if (!result.ok) return describeExerciseNameError(result);
		pick(result.exercise);
		return null;
	}

	function save() {
		run(async () => {
			const input = { name, exercises };
			const result =
				templateId === undefined
					? await templateActions.create(input)
					: await templateActions.update(templateId, input);
			if (result.ok) navigate(WORKOUT_PATH);
			else if (result.reason === "empty") setError("Give the template a name.");
			else setError("This template no longer exists.");
		});
	}

	function remove(savedId: string) {
		if (!window.confirm(`Delete the template “${initial.name}”?`)) return;
		run(async () => {
			await templateActions.remove(savedId);
			navigate(WORKOUT_PATH);
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
		<div className="template-editor">
			<header className="head">
				<h1>{templateId === undefined ? "New template" : "Edit template"}</h1>
			</header>

			<div className="field">
				<label htmlFor={`${id}-name`}>Name</label>
				<input
					id={`${id}-name`}
					type="text"
					autoComplete="off"
					autoCapitalize="sentences"
					enterKeyHint="done"
					placeholder="e.g. Push day"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
			</div>

			{exercises.length === 0 && (
				<p className="empty">No exercises yet. Add the ones you plan to do.</p>
			)}

			{exercises.map((exercise, index) => (
				<TemplateExerciseCard
					// Planned exercises have no id, and one may appear twice.
					// biome-ignore lint/suspicious/noArrayIndexKey: see above
					key={index}
					exercise={exercise}
					name={
						exercisesById?.get(exercise.exerciseId)?.name ?? "Unknown exercise"
					}
					index={index}
					count={exercises.length}
					weightUnit={settings.weightUnit}
					onMove={(toIndex) =>
						setExercises((current) =>
							moveTemplateExercise(current, index, toIndex),
						)
					}
					onRemove={() =>
						setExercises((current) => removeTemplateExercise(current, index))
					}
					onAddSet={() =>
						setExercises((current) => appendPlannedSet(current, index))
					}
					onSetChange={(setIndex, changes) =>
						setExercises((current) =>
							updatePlannedSet(current, index, setIndex, changes),
						)
					}
					onRemoveSet={(setIndex) =>
						setExercises((current) =>
							removePlannedSet(current, index, setIndex),
						)
					}
				/>
			))}

			<button
				type="button"
				className="secondary"
				onClick={() => setPicking(true)}
			>
				Add exercise
			</button>

			{error !== null && (
				<p className="error" role="alert">
					{error}
				</p>
			)}

			<div className="workout-actions">
				<button type="button" className="primary" onClick={save}>
					Save template
				</button>
				<Link to={WORKOUT_PATH} className="secondary link-button">
					Cancel
				</Link>
				{templateId !== undefined && (
					<button
						type="button"
						className="danger"
						onClick={() => remove(templateId)}
					>
						Delete template
					</button>
				)}
			</div>
		</div>
	);
}
