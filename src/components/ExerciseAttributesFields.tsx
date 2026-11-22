import {
	EQUIPMENT,
	EXERCISE_CATEGORIES,
	MOVEMENT_PATTERNS,
	MUSCLE_GROUPS,
} from "../db/constants";
import type { ExerciseAttributes } from "../db/types";
import {
	EQUIPMENT_LABELS,
	EXERCISE_CATEGORY_LABELS,
	isEquipment,
	isExerciseCategory,
	isMovementPattern,
	MOVEMENT_PATTERN_LABELS,
	MUSCLE_GROUP_LABELS,
	type MuscleRole,
	toggleMuscleRole,
} from "../lib/exerciseAttributes";

type ExerciseAttributesFieldsProps = {
	attributes: ExerciseAttributes;
	/**
	 * One change, as an edit of the latest attributes rather than a snapshot
	 * of the rendered ones, so a second tap before the next render does not
	 * undo the first.
	 */
	onEdit: (edit: (current: ExerciseAttributes) => ExerciseAttributes) => void;
};

/** The value of a select's "Not set" option. */
const NOT_SET = "";

const MUSCLE_ROLE_LABELS: Record<MuscleRole, string> = {
	primary: "Primary muscles",
	secondary: "Secondary muscles",
};

/**
 * An exercise's optional attributes (ADR-0016): equipment, category,
 * movement pattern, and primary and secondary muscle groups.
 */
export function ExerciseAttributesFields({
	attributes,
	onEdit,
}: ExerciseAttributesFieldsProps) {
	/** Sets one field, or clears it when undefined. */
	function change<K extends keyof ExerciseAttributes>(
		key: K,
		value: ExerciseAttributes[K] | undefined,
	) {
		onEdit((current) => {
			const next = { ...current };
			if (value === undefined) delete next[key];
			else next[key] = value;
			return next;
		});
	}

	return (
		<>
			<label className="field">
				<span className="label">Equipment</span>
				<select
					value={attributes.equipment ?? NOT_SET}
					onChange={(e) =>
						change(
							"equipment",
							isEquipment(e.target.value) ? e.target.value : undefined,
						)
					}
				>
					<option value={NOT_SET}>Not set</option>
					{EQUIPMENT.map((option) => (
						<option key={option} value={option}>
							{EQUIPMENT_LABELS[option]}
						</option>
					))}
				</select>
			</label>
			<label className="field">
				<span className="label">Category</span>
				<select
					value={attributes.category ?? NOT_SET}
					onChange={(e) =>
						change(
							"category",
							isExerciseCategory(e.target.value) ? e.target.value : undefined,
						)
					}
				>
					<option value={NOT_SET}>Not set</option>
					{EXERCISE_CATEGORIES.map((option) => (
						<option key={option} value={option}>
							{EXERCISE_CATEGORY_LABELS[option]}
						</option>
					))}
				</select>
			</label>
			<label className="field">
				<span className="label">Movement pattern</span>
				<select
					value={attributes.movementPattern ?? NOT_SET}
					onChange={(e) =>
						change(
							"movementPattern",
							isMovementPattern(e.target.value) ? e.target.value : undefined,
						)
					}
				>
					<option value={NOT_SET}>Not set</option>
					{MOVEMENT_PATTERNS.map((option) => (
						<option key={option} value={option}>
							{MOVEMENT_PATTERN_LABELS[option]}
						</option>
					))}
				</select>
			</label>
			{(["primary", "secondary"] as const).map((role) => {
				const chosen =
					role === "primary"
						? attributes.primaryMuscles
						: attributes.secondaryMuscles;
				return (
					<fieldset key={role} className="muscle-picker">
						<legend className="label">{MUSCLE_ROLE_LABELS[role]}</legend>
						<div className="chips">
							{MUSCLE_GROUPS.map((muscle) => {
								const on = chosen?.includes(muscle) ?? false;
								return (
									<button
										key={muscle}
										type="button"
										className={on ? "chip on" : "chip"}
										aria-pressed={on}
										onClick={() =>
											onEdit((current) =>
												toggleMuscleRole(current, role, muscle),
											)
										}
									>
										{MUSCLE_GROUP_LABELS[muscle]}
									</button>
								);
							})}
						</div>
					</fieldset>
				);
			})}
		</>
	);
}
