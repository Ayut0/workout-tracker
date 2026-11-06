import { Link } from "../components/Link";
import { NOTIFICATION_CHECK_PATH } from "../lib/routes";

export function Settings() {
	return (
		<>
			<header className="head">
				<h1>Settings</h1>
			</header>

			<section aria-labelledby="diagnostics">
				<h2 id="diagnostics">Diagnostics</h2>
				<nav className="menu">
					<Link to={NOTIFICATION_CHECK_PATH} className="menu-item">
						<span className="label">Notification check</span>
						<span className="hint">
							Start a rest timer and see how late the notification arrives
						</span>
					</Link>
				</nav>
			</section>
		</>
	);
}
