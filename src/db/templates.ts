import { db, findWorkoutDetail, type WorkoutDB } from "./index";
import type { Template, TemplateExercise } from "./types";
import {
	planNextSet,
	type StartWorkoutResult,
	startWorkout,
} from "./workoutLog";

/**
 * Templates (ADR-0010): reusable workout plans, written and read as whole
 * records. Starting a workout copies a template's exercises and planned sets
 * into new workout records, so editing the workout never changes the
 * template, and editing the template never changes past workouts.
 */

/** What the user edits in a template: its name and planned exercises. */
export interface TemplateInput {
	name: string;
	exercises: TemplateExercise[];
}

export type TemplateResult =
	| { ok: true; template: Template }
	| { ok: false; reason: "empty" }
	| { ok: false; reason: "not-found" };

/** Templates sorted by name ignoring case; the Workout tab lists these. */
export async function listTemplates(
	database: WorkoutDB = db,
): Promise<Template[]> {
	const templates = await database.templates.toArray();
	return templates.sort((a, b) =>
		a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
	);
}

/** One template, or undefined if it does not exist. */
export function findTemplate(
	id: string,
	database: WorkoutDB = db,
): Promise<Template | undefined> {
	return database.templates.get(id);
}

/** Saves a new template. A blank name is rejected; the name is tidied. */
export async function createTemplate(
	input: TemplateInput,
	database: WorkoutDB = db,
): Promise<TemplateResult> {
	const name = tidyTemplateName(input.name);
	if (name === "") return { ok: false, reason: "empty" };
	const template: Template = {
		id: crypto.randomUUID(),
		name,
		exercises: copyTemplateExercises(input.exercises),
	};
	await database.templates.add(template);
	return { ok: true, template };
}

/** Replaces a template's name and exercises. A blank name is rejected. */
export async function updateTemplate(
	id: string,
	input: TemplateInput,
	database: WorkoutDB = db,
): Promise<TemplateResult> {
	const name = tidyTemplateName(input.name);
	if (name === "") return { ok: false, reason: "empty" };
	return database.transaction("rw", database.templates, async () => {
		if (!(await database.templates.get(id))) {
			return { ok: false, reason: "not-found" };
		}
		const template: Template = {
			id,
			name,
			exercises: copyTemplateExercises(input.exercises),
		};
		await database.templates.put(template);
		return { ok: true, template };
	});
}

/**
 * Deletes a template. Workouts started from it are untouched, since they
 * hold their own copies. Destructive: confirm first. False if it was absent.
 */
export async function deleteTemplate(
	id: string,
	database: WorkoutDB = db,
): Promise<boolean> {
	return database.transaction("rw", database.templates, async () => {
		if (!(await database.templates.get(id))) return false;
		await database.templates.delete(id);
		return true;
	});
}

/**
 * Starts a workout from a template: named after it, with its exercises and
 * planned sets copied in (none marked done). Refuses while a workout is
 * active, like startWorkout.
 */
export async function startWorkoutFromTemplate(
	templateId: string,
	startedAt: number,
	database: WorkoutDB = db,
): Promise<StartWorkoutResult | { ok: false; reason: "not-found" }> {
	const template = await database.templates.get(templateId);
	if (!template) return { ok: false, reason: "not-found" };
	return startWorkout(
		{ name: template.name, startedAt, exercises: template.exercises },
		database,
	);
}

export type TemplateFromWorkoutResult =
	| { ok: true; template: Template }
	| { ok: false; reason: "not-found" | "no-complete-sets" };

/**
 * Saves a workout as a new template named after it. Only complete sets are
 * planned (their weight and reps): an incomplete set is one that was skipped.
 * An exercise with no complete set is left out; a workout with none at all
 * gives no template.
 */
export async function templateFromWorkout(
	workoutId: string,
	database: WorkoutDB = db,
): Promise<TemplateFromWorkoutResult> {
	const detail = await findWorkoutDetail(workoutId, database);
	if (!detail) return { ok: false, reason: "not-found" };
	const exercises: TemplateExercise[] = detail.exercises.flatMap((entry) => {
		const sets = entry.sets
			.filter((set) => set.completedAt !== undefined)
			.map(planNextSet);
		return sets.length === 0
			? []
			: [{ exerciseId: entry.workoutExercise.exerciseId, sets }];
	});
	if (exercises.length === 0) return { ok: false, reason: "no-complete-sets" };
	const template: Template = {
		id: crypto.randomUUID(),
		name: tidyTemplateName(detail.workout.name) || FALLBACK_TEMPLATE_NAME,
		exercises,
	};
	await database.templates.add(template);
	return { ok: true, template };
}

/** The name a template saved from a workout gets if the workout has none. */
const FALLBACK_TEMPLATE_NAME = "Workout";

/** A template name as stored: trimmed, with runs of whitespace collapsed. */
function tidyTemplateName(name: string): string {
	return name.trim().replace(/\s+/g, " ");
}

/** Copies planned exercises, keeping only the fields a template stores. */
function copyTemplateExercises(
	exercises: readonly TemplateExercise[],
): TemplateExercise[] {
	return exercises.map((exercise) => ({
		exerciseId: exercise.exerciseId,
		sets: exercise.sets.map(planNextSet),
	}));
}
