import { TABS, type TabId } from "../lib/routes";
import { Link } from "./Link";

/** The bottom tab bar; `active` is null when the URL matches no screen. */
export function TabBar({ active }: { active: TabId | null }) {
	return (
		<nav className="tabbar" aria-label="Tabs">
			{TABS.map((tab) => (
				<Link
					key={tab.id}
					to={tab.path}
					className={tab.id === active ? "tab on" : "tab"}
					aria-current={tab.id === active ? "page" : undefined}
				>
					{tab.label}
				</Link>
			))}
		</nav>
	);
}
