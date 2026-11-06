import { type ChangeEvent, useState } from "react";

/**
 * Props for a text field that saves on every keystroke but shows what the
 * user typed while it has focus. The stored value comes back through a live
 * query a moment later, possibly normalised (e.g. "62." stored as 62), so
 * echoing it into a focused field would fight the typing. On blur the field
 * shows the stored value again.
 */
export function useDraftField(
	stored: string,
	onCommit: (text: string) => void,
) {
	const [draft, setDraft] = useState<string | null>(null);
	return {
		value: draft ?? stored,
		onFocus: () => setDraft(stored),
		onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			setDraft(e.target.value);
			onCommit(e.target.value);
		},
		onBlur: () => setDraft(null),
	};
}
