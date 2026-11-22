import {
	EQUIPMENT,
	EXERCISE_CATEGORIES,
	MOVEMENT_PATTERNS,
	MUSCLE_GROUPS,
} from "../db/constants";
import type {
	Equipment,
	ExerciseAttributes,
	ExerciseCategory,
	MovementPattern,
	MuscleGroup,
} from "../db/types";

/**
 * How the library names an exercise's attributes (ADR-0016): muscle groups,
 * movement pattern, category and equipment. The vocabularies live in
 * src/db/constants.ts, since backups check stored values against them.
 */

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
	chest: "Chest",
	lats: "Lats",
	"upper-back": "Upper back",
	"lower-back": "Lower back",
	"front-delts": "Front delts",
	"side-delts": "Side delts",
	"rear-delts": "Rear delts",
	biceps: "Biceps",
	triceps: "Triceps",
	forearms: "Forearms",
	abs: "Abs",
	glutes: "Glutes",
	quads: "Quads",
	hamstrings: "Hamstrings",
	adductors: "Adductors",
	calves: "Calves",
};

export const MOVEMENT_PATTERN_LABELS: Record<MovementPattern, string> = {
	squat: "Squat",
	hinge: "Hinge",
	lunge: "Lunge",
	"horizontal-push": "Horizontal push",
	"vertical-push": "Vertical push",
	"horizontal-pull": "Horizontal pull",
	"vertical-pull": "Vertical pull",
	carry: "Carry",
	rotation: "Rotation",
	isolation: "Isolation",
};

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
	strength: "Strength",
	power: "Power",
	agility: "Agility",
	mobility: "Mobility",
	core: "Core",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
	barbell: "Barbell",
	dumbbell: "Dumbbell",
	machine: "Machine",
	cable: "Cable",
	bodyweight: "Bodyweight",
	other: "Other",
};

/** Whether a value (such as a select's) names a movement pattern. */
export function isMovementPattern(value: unknown): value is MovementPattern {
	return MOVEMENT_PATTERNS.some((pattern) => pattern === value);
}

/** Whether a value names an exercise category. */
export function isExerciseCategory(value: unknown): value is ExerciseCategory {
	return EXERCISE_CATEGORIES.some((category) => category === value);
}

/** Whether a value names a kind of equipment. */
export function isEquipment(value: unknown): value is Equipment {
	return EQUIPMENT.some((kind) => kind === value);
}

/** The muscles with `muscle` added in vocabulary order, or removed if present. */
export function toggleMuscle(
	muscles: readonly MuscleGroup[] | undefined,
	muscle: MuscleGroup,
): MuscleGroup[] {
	const current = muscles ?? [];
	if (current.includes(muscle)) return current.filter((m) => m !== muscle);
	return MUSCLE_GROUPS.filter((m) => m === muscle || current.includes(m));
}

export type MuscleRole = "primary" | "secondary";

/**
 * Toggles a muscle in one role. Adding it to one role takes it out of the
 * other, since a muscle is primary or secondary, never both (ADR-0016).
 */
export function toggleMuscleRole(
	attributes: ExerciseAttributes,
	role: MuscleRole,
	muscle: MuscleGroup,
): ExerciseAttributes {
	const { primaryMuscles = [], secondaryMuscles = [] } = attributes;
	if (role === "primary") {
		const primary = toggleMuscle(primaryMuscles, muscle);
		return {
			...attributes,
			primaryMuscles: primary,
			secondaryMuscles: secondaryMuscles.filter((m) => !primary.includes(m)),
		};
	}
	const secondary = toggleMuscle(secondaryMuscles, muscle);
	return {
		...attributes,
		primaryMuscles: primaryMuscles.filter((m) => !secondary.includes(m)),
		secondaryMuscles: secondary,
	};
}
