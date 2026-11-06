import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import {
	createTemplate,
	deleteTemplate,
	findTemplate,
	listTemplates,
	startWorkoutFromTemplate,
	type TemplateFromWorkoutResult,
	type TemplateInput,
	type TemplateResult,
	templateFromWorkout,
	updateTemplate,
} from "../db/templates";
import type { Exercise, Template } from "../db/types";
import type { StartWorkoutResult } from "../db/workoutLog";

/** Templates sorted by name, live; undefined while loading. */
export function useTemplates(): Template[] | undefined {
	return useLiveQuery(() => listTemplates(), []);
}

/** One template, live; undefined while loading, null when it does not exist. */
export function useTemplate(id: string): Template | null | undefined {
	return useLiveQuery(async () => (await findTemplate(id)) ?? null, [id]);
}

/**
 * Every exercise by id, archived ones included, so a template still names an
 * exercise that was archived after it was planned. Undefined while loading.
 */
export function useExercisesById(): ReadonlyMap<string, Exercise> | undefined {
	return useLiveQuery(async () => {
		const exercises = await db.exercises.toArray();
		return new Map(exercises.map((exercise) => [exercise.id, exercise]));
	}, []);
}

/** The template write actions, bound to the app database and clock. */
export const templateActions = {
	create: (input: TemplateInput): Promise<TemplateResult> =>
		createTemplate(input),
	update: (id: string, input: TemplateInput): Promise<TemplateResult> =>
		updateTemplate(id, input),
	remove: (id: string): Promise<boolean> => deleteTemplate(id),
	start: (
		id: string,
	): Promise<StartWorkoutResult | { ok: false; reason: "not-found" }> =>
		startWorkoutFromTemplate(id, Date.now()),
	saveFromWorkout: (workoutId: string): Promise<TemplateFromWorkoutResult> =>
		templateFromWorkout(workoutId),
};
