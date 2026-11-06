import { type FormEvent, useState } from "react";
import { Link } from "../components/Link";
import { StrongImport } from "../components/StrongImport";
import type { WeightUnit } from "../db/types";
import { useSettings } from "../hooks/useSettings";
import {
	formatRestDuration,
	MAX_REST_SECONDS,
	MIN_REST_SECONDS,
	parseRestSeconds,
} from "../lib/restDuration";
import { NOTIFICATION_CHECK_PATH } from "../lib/routes";

const WEIGHT_UNITS: { unit: WeightUnit; label: string }[] = [
	{ unit: "kg", label: "Kilograms (kg)" },
	{ unit: "lb", label: "Pounds (lb)" },
];

const REST_PRESETS = [60, 90, 120, 180];

export function Settings() {
	const { settings, loaded, save } = useSettings();

	return (
		<>
			<header className="head">
				<h1>Settings</h1>
			</header>

			<section aria-labelledby="units">
				<h2 id="units">Weight unit</h2>
				<fieldset className="segmented" disabled={!loaded}>
					<legend className="visually-hidden">Weight unit</legend>
					{WEIGHT_UNITS.map(({ unit, label }) => (
						<button
							key={unit}
							type="button"
							className={unit === settings.weightUnit ? "chip on" : "chip"}
							aria-pressed={unit === settings.weightUnit}
							onClick={() => save({ weightUnit: unit })}
						>
							{label}
						</button>
					))}
				</fieldset>
				<p className="lead">
					Weights are stored in kg; this only changes how they are shown and
					typed.
				</p>
			</section>

			<RestSection
				restSeconds={settings.restSeconds}
				disabled={!loaded}
				onSave={(restSeconds) => save({ restSeconds })}
			/>

			<section aria-labelledby="backup">
				<h2 id="backup">Backup</h2>
				{/* Export / restore (#37) goes here. */}
				<StrongImport />
			</section>

			<section aria-labelledby="diagnostics">
				<h2 id="diagnostics">Diagnostics</h2>
				<nav className="menu">
					<Link to={NOTIFICATION_CHECK_PATH} className="menu-item">
						<span className="label">Notification check</span>
						<span className="hint">
							Start a rest timer and see how late the notification arrives
						</span>
					</Link>
				</nav>
			</section>
		</>
	);
}

type RestSectionProps = {
	restSeconds: number;
	disabled: boolean;
	onSave: (restSeconds: number) => void;
};

/** The default rest: presets plus a field for any number of seconds. */
function RestSection({ restSeconds, disabled, onSave }: RestSectionProps) {
	// What the user is typing; null shows the saved value.
	const [draft, setDraft] = useState<string | null>(null);
	const [invalid, setInvalid] = useState(false);

	function commit() {
		if (draft === null) return;
		const parsed = parseRestSeconds(draft);
		if (parsed === undefined) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		setDraft(null);
		if (parsed !== restSeconds) onSave(parsed);
	}

	function submit(e: FormEvent) {
		e.preventDefault();
		commit();
	}

	function pick(seconds: number) {
		setDraft(null);
		setInvalid(false);
		onSave(seconds);
	}

	return (
		<section aria-labelledby="rest">
			<h2 id="rest">Default rest</h2>
			<form className="stack" onSubmit={submit}>
				<fieldset className="presets" disabled={disabled}>
					<legend className="visually-hidden">Rest presets</legend>
					{REST_PRESETS.map((s) => (
						<button
							key={s}
							type="button"
							className={s === restSeconds ? "chip on" : "chip"}
							aria-pressed={s === restSeconds}
							onClick={() => pick(s)}
						>
							{formatRestDuration(s)}
						</button>
					))}
				</fieldset>
				<label className="field">
					<span className="label">Seconds</span>
					<input
						type="text"
						inputMode="numeric"
						enterKeyHint="done"
						autoComplete="off"
						disabled={disabled}
						value={draft ?? String(restSeconds)}
						aria-invalid={invalid}
						aria-describedby="rest-hint"
						onChange={(e) => setDraft(e.target.value)}
						onBlur={commit}
					/>
				</label>
				<p
					id="rest-hint"
					className={invalid ? "error" : "lead"}
					role={invalid ? "alert" : undefined}
				>
					{invalid
						? `Enter ${MIN_REST_SECONDS}–${MAX_REST_SECONDS} seconds, or m:ss.`
						: `${formatRestDuration(restSeconds)} after each set, unless an exercise sets its own.`}
				</p>
			</form>
		</section>
	);
}
