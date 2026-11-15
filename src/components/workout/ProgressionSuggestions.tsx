import type { WeightUnit } from "../../db/types";
import type { SetUpdate } from "../../db/workoutLog";
import {
	describeSuggestion,
	type ExerciseSuggestion,
} from "../../lib/suggestions";

type ProgressionSuggestionsProps = {
	suggestions: readonly ExerciseSuggestion[];
	weightUnit: WeightUnit;
	/** Names the exercise for screen readers, e.g. "Bench Press". */
	exerciseName: string;
	/** Fills today's matching working sets with the suggestion. */
	onUse: (fills: SetUpdate[]) => void;
};

/**
 * What Progression suggests for this exercise (#71, ADR-0017), one line per
 * rep-range group, e.g. "4–6 reps · Next: 72.5 kg × 4 (3 sets)", each with a
 * "Use" button while it has sets left to fill. Nothing without suggestions.
 */
export function ProgressionSuggestions({
	suggestions,
	weightUnit,
	exerciseName,
	onUse,
}: ProgressionSuggestionsProps) {
	if (suggestions.length === 0) return null;
	return (
		<ul className="suggestions" aria-label={`Suggested for ${exerciseName}`}>
			{suggestions.map((suggestion) => {
				const text = describeSuggestion(suggestion, weightUnit);
				return (
					<li key={`${suggestion.repMin}-${suggestion.repMax}-${text}`}>
						<span className="suggestion-text">{text}</span>
						{suggestion.fills.length > 0 && (
							<button
								type="button"
								className="secondary suggestion-use"
								aria-label={`Use for ${exerciseName}: ${text}`}
								onClick={() => {
									// A focused field shows its draft, not the stored value
									// (useDraftField); blur it so the filled values show.
									if (document.activeElement instanceof HTMLElement) {
										document.activeElement.blur();
									}
									onUse(suggestion.fills);
								}}
							>
								Use
							</button>
						)}
					</li>
				);
			})}
		</ul>
	);
}
