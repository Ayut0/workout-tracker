import { TabBar } from "./components/TabBar";
import { useRoute } from "./hooks/useRoute";
import type { Route } from "./lib/routes";
import { Exercises } from "./screens/Exercises";
import { NotificationCheck } from "./screens/NotificationCheck";
import { Placeholder } from "./screens/Placeholder";
import { Progress } from "./screens/Progress";
import { Settings } from "./screens/Settings";

/** The app shell: the screen for the current URL above the bottom tab bar. */
export function App() {
	const route = useRoute();

	return (
		<>
			<main className="app">
				<Screen route={route} />
			</main>
			<TabBar active={route?.tab ?? null} />
		</>
	);
}

function Screen({ route }: { route: Route | null }) {
	switch (route?.name) {
		case "workout":
			return (
				<Placeholder
					title="Workout"
					text="Start a workout and log your sets here."
				/>
			);
		case "history":
			return (
				<Placeholder
					title="History"
					text="Your past workouts will show here."
				/>
			);
		case "exercises":
			return <Exercises />;
		case "progress":
			return <Progress />;
		case "settings":
			return <Settings />;
		case "notification-check":
			return <NotificationCheck />;
		case undefined:
			return (
				<Placeholder
					title="Page not found"
					text="Nothing lives at this address. Pick a tab below."
				/>
			);
	}
}
