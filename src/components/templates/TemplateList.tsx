import type { Template } from "../../db/types";
import { NEW_TEMPLATE_PATH, templatePath } from "../../lib/routes";
import { countPlannedSets } from "../../lib/templates";
import { Link } from "../Link";

type TemplateListProps = {
	/** Templates in display order; undefined while loading. */
	templates: Template[] | undefined;
	onStart: (template: Template) => void;
};

/** The saved templates, each with Start and Edit, and a link to make a new one. */
export function TemplateList({ templates, onStart }: TemplateListProps) {
	return (
		<section className="templates" aria-labelledby="templates-title">
			<h2 id="templates-title">Templates</h2>
			{templates?.length === 0 && (
				<p className="empty">
					No templates yet. Save a routine to start a workout from it.
				</p>
			)}
			{templates && templates.length > 0 && (
				<ul className="template-list">
					{templates.map((template) => (
						<li key={template.id} className="template-item">
							<Link
								to={templatePath(template.id)}
								className="template-link"
								aria-label={`Edit ${template.name}`}
							>
								<span className="template-name">{template.name}</span>
								<span className="template-summary">
									{describeTemplate(template)}
								</span>
							</Link>
							<button
								type="button"
								className="chip"
								aria-label={`Start ${template.name}`}
								onClick={() => onStart(template)}
							>
								Start
							</button>
						</li>
					))}
				</ul>
			)}
			<Link to={NEW_TEMPLATE_PATH} className="secondary link-button">
				New template
			</Link>
		</section>
	);
}

/** E.g. "2 exercises · 5 sets". */
function describeTemplate(template: Template): string {
	const exercises = template.exercises.length;
	const sets = countPlannedSets(template.exercises);
	return `${exercises} ${exercises === 1 ? "exercise" : "exercises"} · ${sets} ${sets === 1 ? "set" : "sets"}`;
}
