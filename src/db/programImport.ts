import {
	db,
	normalizeExerciseName,
	tidyExerciseName,
	type WorkoutDB,
} from "./index";
import {
	describeUnusedField,
	findUnusedSetFields,
	type ProgramDay,
	type ProgramFile,
	type ProgramSet,
	type ProgramWeek,
	truncateProblems,
} from "./programFormat";
import { tidyTemplateName } from "./templates";
import {
	DEFAULT_SET_MEASURE,
	type Exercise,
	PLANNED_TARGET_FIELDS,
	type ProgramLink,
	type SetMeasure,
	type Template,
	type TemplateExercise,
	type TemplateSet,
} from "./types";
import { resolveMeasure, tidyNotes } from "./workoutLog";

/**
 * Importing a checked program file as templates (ADR-0019). Additive, unlike
 * a restore: it adds one template per week and day, and the exercises the
 * library lacks; it never changes or deletes a record, and leaves history
 * alone. Two steps, like the Strong import: a pure plan the preview shows,
 * then a write that plans again inside its transaction.
 */

/** An exercise the import creates, with the measure the file gives it. */
export interface NewProgramExercise {
	name: string;
	measure: SetMeasure;
}

/** An exercise the library has with another measure than the file says. */
export interface MeasureMismatch {
	name: string;
	fileMeasure: SetMeasure;
	libraryMeasure: SetMeasure;
}

/** A template the import would add, before ids are given. */
export interface PlannedProgramTemplate {
	name: string;
	program: ProgramLink;
	exercises: { nameKey: string; notes?: string; sets: TemplateSet[] }[];
}

export interface ProgramImportPlan {
	programId: string;
	programName: string;
	/** The blocks in the file, in file order. */
	blocks: number[];
	templates: PlannedProgramTemplate[];
	newExercises: NewProgramExercise[];
	/** How many of the file's exercises the library already has. */
	matchedExerciseCount: number;
	/** Library exercises whose measure differs; the library's is kept. */
	measureMismatches: MeasureMismatch[];
	/**
	 * Planned set fields the exercise's measure (the library's, or the file's
	 * or default for a new exercise) does not use, each with its JSON path.
	 * The import refuses while any is listed: they would vanish silently.
	 */
	setErrors: string[];
	/**
	 * Blocks of this program already imported (templates carry them). The
	 * import refuses while any is listed.
	 */
	alreadyImportedBlocks: number[];
}

export type ProgramImportResult =
	| { ok: true; templatesCreated: number; exercisesCreated: number }
	| { ok: false; reason: "already-imported"; blocks: number[] }
	| { ok: false; reason: "invalid-sets"; errors: string[] };

/**
 * A template's name: "<Program> · W1 · A — Lower"; blocks after the first
 * add "B2 · " before the week, so templates of two blocks never share a name.
 */
export function buildProgramTemplateName(
	programName: string,
	block: number,
	week: ProgramWeek,
	day: ProgramDay,
): string {
	const blockPart = block > 1 ? `B${block} · ` : "";
	const dayName = day.name === undefined ? "" : ` — ${day.name.trim()}`;
	return tidyTemplateName(
		`${programName.trim()} · ${blockPart}W${week.week} · ${day.day.trim()}${dayName}`,
	);
}

/** A program id compared ignoring case and spacing, as exercise names are. */
function buildProgramKey(programId: string): string {
	return normalizeExerciseName(programId);
}

/** A planned set with only the fields a template stores. */
function copyProgramSet(set: ProgramSet): TemplateSet {
	const copy: TemplateSet = {};
	if (set.weightKg !== undefined) copy.weightKg = set.weightKg;
	if (set.reps !== undefined) copy.reps = set.reps;
	if (set.seconds !== undefined) copy.seconds = set.seconds;
	if (set.distanceM !== undefined) copy.distanceM = set.distanceM;
	if (set.warmup) copy.warmup = true;
	for (const field of PLANNED_TARGET_FIELDS) {
		const value = set[field];
		if (value !== undefined) copy[field] = value;
	}
	return copy;
}

/**
 * Checks every planned set against the measure its exercise really has: the
 * library's for a matched exercise (the file's measure is used only for a new
 * one), else the file's or the default. A field that measure does not use
 * would be dropped when a workout starts from the template.
 */
function checkSetsAgainstMeasures(
	program: ProgramFile,
	matched: ReadonlyMap<string, Exercise>,
	created: ReadonlyMap<string, NewProgramExercise>,
	fileMeasures: ReadonlyMap<string, SetMeasure>,
): string[] {
	const errors: string[] = [];
	program.blocks.forEach((block, b) => {
		block.weeks.forEach((week, w) => {
			week.days.forEach((day, d) => {
				day.exercises.forEach((exercise, e) => {
					const nameKey = normalizeExerciseName(exercise.name);
					const library = matched.get(nameKey);
					const measure = library
						? resolveMeasure(library)
						: (created.get(nameKey)?.measure ?? DEFAULT_SET_MEASURE);
					const reason = library
						? `which "${library.name}" has in your library`
						: fileMeasures.has(nameKey)
							? `which the file gives "${tidyExerciseName(exercise.name)}"`
							: `which "${tidyExerciseName(exercise.name)}" is given because the file names no measure for it`;
					exercise.sets.forEach((set, s) => {
						for (const field of findUnusedSetFields(set, measure)) {
							errors.push(
								`blocks[${b}].weeks[${w}].days[${d}].exercises[${e}].sets[${s}].${field}: ${describeUnusedField(measure)}, ${reason}.`,
							);
						}
					});
				});
			});
		});
	});
	return truncateProblems(errors);
}

/** What importing `program` would add, given what is stored. Pure. */
export function planProgramImport(
	program: ProgramFile,
	storedExercises: readonly Exercise[],
	storedTemplates: readonly Template[],
): ProgramImportPlan {
	const programId = tidyTemplateName(program.programId);
	const programName = program.name.trim();
	const stored = new Map(storedExercises.map((e) => [e.nameKey, e]));
	const newExercises = new Map<string, NewProgramExercise>();
	const matched = new Map<string, Exercise>();
	const fileMeasures = new Map<string, SetMeasure>();
	const templates: PlannedProgramTemplate[] = [];

	for (const block of program.blocks) {
		for (const week of block.weeks) {
			for (const day of week.days) {
				const link: ProgramLink = {
					programId,
					programName,
					block: block.block,
					week: week.week,
					day: tidyTemplateName(day.day),
				};
				if (week.deload) link.deload = true;
				templates.push({
					name: buildProgramTemplateName(programName, block.block, week, day),
					program: link,
					exercises: day.exercises.map((exercise) => {
						const nameKey = normalizeExerciseName(exercise.name);
						if (exercise.measure !== undefined) {
							fileMeasures.set(nameKey, exercise.measure);
						}
						const existing = stored.get(nameKey);
						if (existing) matched.set(nameKey, existing);
						else if (!newExercises.has(nameKey)) {
							newExercises.set(nameKey, {
								name: tidyExerciseName(exercise.name),
								measure: DEFAULT_SET_MEASURE,
							});
						}
						const notes = tidyNotes(exercise.notes);
						return {
							nameKey,
							...(notes === undefined ? {} : { notes }),
							sets: exercise.sets.map(copyProgramSet),
						};
					}),
				});
			}
		}
	}

	// The file gives an exercise one measure (parseProgram checks), possibly
	// on a later mention than the first.
	for (const [nameKey, exercise] of newExercises) {
		exercise.measure = fileMeasures.get(nameKey) ?? DEFAULT_SET_MEASURE;
	}
	const measureMismatches: MeasureMismatch[] = [];
	for (const [nameKey, exercise] of matched) {
		const fileMeasure = fileMeasures.get(nameKey);
		const libraryMeasure = resolveMeasure(exercise);
		if (fileMeasure !== undefined && fileMeasure !== libraryMeasure) {
			measureMismatches.push({
				name: exercise.name,
				fileMeasure,
				libraryMeasure,
			});
		}
	}

	const setErrors = checkSetsAgainstMeasures(
		program,
		matched,
		newExercises,
		fileMeasures,
	);

	const blocks = program.blocks.map((block) => block.block);
	const key = buildProgramKey(programId);
	const imported = new Set(
		storedTemplates.flatMap((template) =>
			template.program && buildProgramKey(template.program.programId) === key
				? [template.program.block]
				: [],
		),
	);
	return {
		programId,
		programName,
		blocks,
		templates,
		newExercises: [...newExercises.values()],
		matchedExerciseCount: matched.size,
		measureMismatches,
		setErrors,
		alreadyImportedBlocks: blocks.filter((block) => imported.has(block)),
	};
}

/** The plan against what is stored now; writes nothing. */
export async function previewProgramImport(
	program: ProgramFile,
	database: WorkoutDB = db,
): Promise<ProgramImportPlan> {
	return database.transaction(
		"r",
		[database.exercises, database.templates],
		async () =>
			planProgramImport(
				program,
				await database.exercises.toArray(),
				await database.templates.toArray(),
			),
	);
}

/**
 * Adds the program's templates and the exercises the library lacks, in one
 * transaction: all of it or, if anything fails, none. Plans again inside the
 * transaction, so a preview that went stale cannot add a block twice or
 * clash with an exercise created since. Refuses a block of this program that
 * is already imported; existing records are never changed.
 */
export async function importProgram(
	program: ProgramFile,
	database: WorkoutDB = db,
): Promise<ProgramImportResult> {
	return database.transaction(
		"rw",
		[database.exercises, database.templates],
		async () => {
			const stored = await database.exercises.toArray();
			const plan = planProgramImport(
				program,
				stored,
				await database.templates.toArray(),
			);
			if (plan.setErrors.length > 0) {
				return {
					ok: false,
					reason: "invalid-sets",
					errors: plan.setErrors,
				};
			}
			if (plan.alreadyImportedBlocks.length > 0) {
				return {
					ok: false,
					reason: "already-imported",
					blocks: plan.alreadyImportedBlocks,
				};
			}
			const created: Exercise[] = plan.newExercises.map(
				({ name, measure }) => ({
					id: crypto.randomUUID(),
					name,
					nameKey: normalizeExerciseName(name),
					...(measure === DEFAULT_SET_MEASURE ? {} : { measure }),
				}),
			);
			const ids = new Map(
				[...stored, ...created].map((exercise) => [
					exercise.nameKey,
					exercise.id,
				]),
			);
			const templates: Template[] = plan.templates.map((planned) => ({
				id: crypto.randomUUID(),
				name: planned.name,
				program: planned.program,
				exercises: planned.exercises.map(
					({ nameKey, notes, sets }): TemplateExercise => {
						const exerciseId = ids.get(nameKey);
						// The plan creates every exercise it does not find, so this holds.
						if (exerciseId === undefined) {
							throw new Error(`No exercise for "${nameKey}"`);
						}
						return {
							exerciseId,
							sets,
							...(notes === undefined ? {} : { notes }),
						};
					},
				),
			}));
			await database.exercises.bulkAdd(created);
			await database.templates.bulkAdd(templates);
			return {
				ok: true,
				templatesCreated: templates.length,
				exercisesCreated: created.length,
			};
		},
	);
}
