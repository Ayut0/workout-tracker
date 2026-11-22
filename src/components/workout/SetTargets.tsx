import type { PlannedTargets } from "../../db/types";
import { describePlannedTargets } from "../../lib/plannedTargets";

type SetTargetsProps = {
	targets: PlannedTargets;
};

/**
 * What a set aims for, copied from its template (ADR-0014), e.g.
 * "4–6 reps · RIR 2", under the set's inputs. Nothing when it has none.
 */
export function SetTargets({ targets }: SetTargetsProps) {
	const text = describePlannedTargets(targets);
	if (text === undefined) return null;
	return <span className="set-target">Target {text}</span>;
}
