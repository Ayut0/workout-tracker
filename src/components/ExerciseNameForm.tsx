import { type FormEvent, useId, useState } from "react";

type ExerciseNameFormProps = {
	label: string;
	submitLabel: string;
	initialName?: string;
	/** Saves the name; resolves to an error message, or null on success. */
	onSubmit: (name: string) => Promise<string | null>;
	/** Clears the field after a successful save. */
	clearOnSuccess?: boolean;
};

/** A name field with a submit button that shows why a name was rejected. */
export function ExerciseNameForm({
	label,
	submitLabel,
	initialName = "",
	onSubmit,
	clearOnSuccess = false,
}: ExerciseNameFormProps) {
	const id = useId();
	const [name, setName] = useState(initialName);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function submit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setBusy(true);
		try {
			const message = await onSubmit(name);
			setError(message);
			if (message === null && clearOnSuccess) setName("");
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<form className="name-form" onSubmit={submit}>
			<label htmlFor={id}>{label}</label>
			<div className="name-form-row">
				<input
					id={id}
					className="text-input"
					type="text"
					autoComplete="off"
					autoCapitalize="words"
					enterKeyHint="done"
					value={name}
					aria-invalid={error !== null}
					aria-describedby={error === null ? undefined : `${id}-error`}
					onChange={(e) => {
						setName(e.target.value);
						setError(null);
					}}
				/>
				<button type="submit" className="small-primary" disabled={busy}>
					{submitLabel}
				</button>
			</div>
			{error !== null && (
				<p id={`${id}-error`} className="error" role="alert">
					{error}
				</p>
			)}
		</form>
	);
}
