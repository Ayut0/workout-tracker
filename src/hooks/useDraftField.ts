import { type ChangeEvent, useState } from "react";

/**
 * Props for a text field that saves on every keystroke but shows what the
 * user typed while it has focus. The stored value comes back through a live
 * query a moment later, possibly normalised (e.g. "62." stored as 62), so
 * echoing it into a focused field would fight the typing. On blur the field
 * shows the stored value again, unless `isValid` says the text typed does not
 * read: then the text stays (so the field can keep showing as invalid) while
 * the last stored value is kept, until the text reads or is changed.
 */
export function useDraftField(
	stored: string,
	onCommit: (text: string) => void,
	isValid: (text: string) => boolean = () => true,
) {
	const [draft, setDraft] = useState<string | null>(null);
	return {
		value: draft ?? stored,
		onFocus: () => setDraft((current) => current ?? stored),
		onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			setDraft(e.target.value);
			onCommit(e.target.value);
		},
		onBlur: () =>
			setDraft((current) =>
				current !== null && !isValid(current) ? current : null,
			),
	};
}
