import { type FormEvent, useId, useState } from "react";
import { prepareInstructions } from "../db/instructions";
import type { ExerciseInstructions } from "../db/types";
import {
	getInstructionsCounter,
	isInstructionsDraftChanged,
} from "../lib/instructions";

type ExerciseInstructionsFormProps = {
	/** What is stored; the draft starts from it. */
	instructions: ExerciseInstructions;
	/** Saves checked instructions; resolves to false when nothing was saved. */
	onSave: (instructions: ExerciseInstructions) => Promise<boolean>;
};

type FieldError = { field: "text" | "url"; reason: string };

/**
 * An exercise's instructions (ADR-0020): plain text and a web link, written
 * by the lifter and saved together. An invalid field says why and keeps the
 * draft; clearing both and saving removes the instructions. Give it a `key`
 * per exercise so the draft resets when another exercise is opened.
 */
export function ExerciseInstructionsForm({
	instructions,
	onSave,
}: ExerciseInstructionsFormProps) {
	const id = useId();
	const [text, setText] = useState(instructions.instructions ?? "");
	const [url, setUrl] = useState(instructions.instructionsUrl ?? "");
	const [error, setError] = useState<FieldError | null>(null);
	const [saveFailed, setSaveFailed] = useState(false);
	const [busy, setBusy] = useState(false);

	const changed = isInstructionsDraftChanged({ text, url }, instructions);
	const counter = getInstructionsCounter(text);
	const textError = error?.field === "text" ? error.reason : null;
	const urlError = error?.field === "url" ? error.reason : null;

	async function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const result = prepareInstructions({ text, url });
		if (!result.ok) {
			setError({ field: result.field, reason: result.reason });
			return;
		}
		setError(null);
		setBusy(true);
		try {
			const saved = await onSave(result.instructions);
			setSaveFailed(!saved);
			if (saved) {
				setText(result.instructions.instructions ?? "");
				setUrl(result.instructions.instructionsUrl ?? "");
			}
		} catch {
			setSaveFailed(true);
		} finally {
			setBusy(false);
		}
	}

	return (
		// noValidate: the browser's own url check would hide prepareInstructions' reason.
		<form className="stack" noValidate onSubmit={handleSubmit}>
			<label className="field">
				<span className="label">Instructions</span>
				<textarea
					className="text-input notes-input"
					rows={4}
					autoCapitalize="sentences"
					placeholder="How you perform it, in your own words"
					value={text}
					aria-invalid={textError !== null}
					aria-describedby={textError === null ? undefined : `${id}-text`}
					onChange={(e) => {
						setText(e.target.value);
						if (error?.field === "text") setError(null);
					}}
				/>
			</label>
			{counter !== undefined && (
				<p className="hint" aria-live="polite">
					{counter}
				</p>
			)}
			{textError !== null && (
				<p id={`${id}-text`} className="error" role="alert">
					{textError}
				</p>
			)}
			<label className="field">
				<span className="label">Link</span>
				<input
					type="url"
					inputMode="url"
					autoComplete="off"
					autoCapitalize="off"
					spellCheck={false}
					enterKeyHint="done"
					placeholder="https://"
					value={url}
					aria-invalid={urlError !== null}
					aria-describedby={urlError === null ? undefined : `${id}-url`}
					onChange={(e) => {
						setUrl(e.target.value);
						if (error?.field === "url") setError(null);
					}}
				/>
			</label>
			{urlError !== null && (
				<p id={`${id}-url`} className="error" role="alert">
					{urlError}
				</p>
			)}
			{saveFailed && (
				<p className="error" role="alert">
					Could not save the instructions.
				</p>
			)}
			<div className="name-form-row instructions-actions">
				<button
					type="submit"
					className="small-primary"
					disabled={!changed || busy}
				>
					Save instructions
				</button>
				{changed && (
					<p className="hint" role="status">
						Unsaved
					</p>
				)}
			</div>
		</form>
	);
}
