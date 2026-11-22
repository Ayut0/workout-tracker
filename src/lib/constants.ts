import type { ProgressionAction } from "./progression";

/** The short label before a suggestion's sets, by what the rule suggests. */
export const ACTION_LABELS: Record<ProgressionAction, string> = {
	increase: "Next",
	addRep: "Same weight, aim for +1 rep",
	keep: "Same weight and reps",
	deload: "Deload",
};
