import { useState } from "react";
import {
	importStrongWorkouts,
	previewStrongImport,
	type StrongImportPlan,
	type StrongImportResult,
} from "../db/strongImport";
import { requestPersistentStorage } from "../lib/persistentStorage";
import {
	PARSE_KIND,
	parseStrongCsv,
	type StrongParseOptions,
	type UnitKind,
} from "../lib/strongCsv";

/** Where the Strong import is: pick a file → (units) → preview → done. */
export type StrongImportState =
	| { step: "idle" }
	| { step: "busy"; message: string }
	/** The export does not say these units; ask, then parse again. */
	| { step: "needsUnits"; text: string; missing: UnitKind[] }
	| { step: "preview"; plan: StrongImportPlan }
	| { step: "done"; result: StrongImportResult }
	| { step: "error"; message: string };

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * The Strong import flow: reads and parses the CSV, previews what it would
 * add, and on confirm asks for persistent storage and writes it in one
 * transaction. Nothing is written before confirm.
 */
export function useStrongImport() {
	const [state, setState] = useState<StrongImportState>({ step: "idle" });

	async function preview(text: string, options: StrongParseOptions) {
		const parsed = parseStrongCsv(text, options);
		if (parsed.kind === PARSE_KIND.invalid) {
			setState({ step: "error", message: parsed.reason });
			return;
		}
		if (parsed.kind === PARSE_KIND.needsUnits) {
			setState({ step: "needsUnits", text, missing: parsed.missing });
			return;
		}
		const plan = await previewStrongImport(parsed.workouts, parsed.skipped);
		setState({ step: "preview", plan });
	}

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
		/** Reads the chosen export and shows its preview. */
		chooseFile: (file: File) =>
			run("Reading the export…", async () => preview(await file.text(), {})),
		/** Parses the export again with the units the lifter chose. */
		chooseUnits: (text: string, options: StrongParseOptions) =>
			run("Reading the export…", () => preview(text, options)),
		/** Writes the previewed workouts. */
		confirm: (plan: StrongImportPlan) =>
			run("Importing…", async () => {
				await requestPersistentStorage(navigator.storage);
				const result = await importStrongWorkouts(plan.workouts);
				setState({ step: "done", result });
			}),
		reset: () => setState({ step: "idle" }),
	};
}
