import { useId, useState } from "react";
import {
	getInstructionsToShow,
	getLinkLabel,
	type InstructionsToShow,
} from "../../lib/instructions";

type InstructionsRowProps = {
	instructions: string | undefined;
	instructionsUrl: string | undefined;
};

/**
 * An exercise's instructions (ADR-0020) under its name while logging: always
 * collapsed when the card appears, one tap opens or closes it. The text is
 * plain text with its line breaks kept; the link shows its host and opens in
 * a new tab, and is left out unless it is a safe http(s) link. Nothing at
 * all when there is nothing to show.
 */
export function InstructionsRow({
	instructions,
	instructionsUrl,
}: InstructionsRowProps) {
	const shown = getInstructionsToShow({ instructions, instructionsUrl });
	return shown === undefined ? null : <InstructionsToggle {...shown} />;
}

/** The collapsible row itself, starting closed. */
function InstructionsToggle({ text, url }: InstructionsToShow) {
	const [open, setOpen] = useState(false);
	const panelId = useId();
	return (
		<div className="instructions">
			<button
				type="button"
				className="instructions-toggle"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={() => setOpen((wasOpen) => !wasOpen)}
			>
				<span aria-hidden="true">{open ? "▾" : "▸"}</span> Instructions
			</button>
			<div id={panelId} className="instructions-body" hidden={!open}>
				{text !== undefined && <p className="instructions-text">{text}</p>}
				{url !== undefined && (
					<a href={url} target="_blank" rel="noopener noreferrer">
						{getLinkLabel(url)} <span aria-hidden="true">↗</span>
					</a>
				)}
			</div>
		</div>
	);
}
