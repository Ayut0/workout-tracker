import { useState } from "react";
import { type ProgramFile, parseProgram } from "../db/programFormat";
import {
	importProgram,
	type ProgramImportPlan,
	previewProgramImport,
} from "../db/programImport";
import { requestPersistentStorage } from "../lib/persistentStorage";

/** Where the program import is: pick a file → preview → done. */
export type ProgramImportState =
	| { step: "idle" }
	| { step: "busy"; message: string }
	/** The file is not a valid program; every problem found, with its path. */
	| { step: "invalid"; errors: string[] }
	| { step: "preview"; program: ProgramFile; plan: ProgramImportPlan }
	| { step: "done"; templatesCreated: number; exercisesCreated: number }
	| { step: "error"; message: string };

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * The program import flow (ADR-0019): reads and checks the file, previews
 * what it would add, and on confirm asks for persistent storage and adds the
 * templates in one transaction. Nothing is written before confirm.
 */
export function useProgramImport() {
	const [state, setState] = useState<ProgramImportState>({ step: "idle" });

	async function run(message: string, work: () => Promise<void>) {
		setState({ step: "busy", message });
		try {
			await work();
		} catch (error) {
			setState({ step: "error", message: describeError(error) });
		}
	}

	return {
		state,
		/** Reads and checks a program file and shows what importing it adds. */
		chooseFile: (file: File) =>
			run("Reading the program…", async () => {
				const parsed = parseProgram(await file.text());
				if (!parsed.ok) {
					setState({ step: "invalid", errors: parsed.errors });
					return;
				}
				const plan = await previewProgramImport(parsed.program);
				setState({ step: "preview", program: parsed.program, plan });
			}),
		/** Adds the previewed program's templates. */
		confirm: (program: ProgramFile) =>
			run("Importing…", async () => {
				await requestPersistentStorage(navigator.storage);
				const result = await importProgram(program);
				if (!result.ok) {
					// Imported elsewhere since the preview: show it as the preview would.
					const plan = await previewProgramImport(program);
					setState({ step: "preview", program, plan });
					return;
				}
				setState({
					step: "done",
					templatesCreated: result.templatesCreated,
					exercisesCreated: result.exercisesCreated,
				});
			}),
		reset: () => setState({ step: "idle" }),
	};
}
