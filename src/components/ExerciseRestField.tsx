import { type FormEvent, useId, useState } from "react";
import {
	formatRestDuration,
	MAX_REST_SECONDS,
	MIN_REST_SECONDS,
	parseRestOverride,
} from "../lib/restDuration";

type ExerciseRestFieldProps = {
	/** The exercise's own rest; undefined when it uses the default. */
	restSeconds: number | undefined;
	defaultSeconds: number;
	onSave: (restSeconds: number | undefined) => void;
};

/** An exercise's own rest in seconds; blank uses the default rest. */
export function ExerciseRestField({
	restSeconds,
	defaultSeconds,
	onSave,
}: ExerciseRestFieldProps) {
	const id = useId();
	// What the user is typing; null shows the saved value.
	const [draft, setDraft] = useState<string | null>(null);
	const [invalid, setInvalid] = useState(false);

	function commit() {
		if (draft === null) return;
		const parsed = parseRestOverride(draft);
		if (parsed === null) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		setDraft(null);
		if (parsed.seconds !== restSeconds) onSave(parsed.seconds);
	}

	function submit(e: FormEvent) {
		e.preventDefault();
		commit();
	}

	return (
		<form className="stack" onSubmit={submit}>
			<label className="field">
				<span className="label">Rest (seconds)</span>
				<input
					type="text"
					inputMode="numeric"
					enterKeyHint="done"
					autoComplete="off"
					placeholder={`Default (${formatRestDuration(defaultSeconds)})`}
					value={
						draft ?? (restSeconds === undefined ? "" : String(restSeconds))
					}
					aria-invalid={invalid}
					aria-describedby={`${id}-hint`}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={commit}
				/>
			</label>
			<p
				id={`${id}-hint`}
				className={invalid ? "error" : "hint"}
				role={invalid ? "alert" : undefined}
			>
				{invalid
					? `Enter ${MIN_REST_SECONDS}–${MAX_REST_SECONDS} seconds, or m:ss. Leave blank for the default.`
					: restSeconds === undefined
						? `Uses the default rest (${formatRestDuration(defaultSeconds)}).`
						: `${formatRestDuration(restSeconds)} after each set of this exercise.`}
			</p>
		</form>
	);
}
