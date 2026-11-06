import { RestSessionProvider } from "./components/RestSessionProvider";
import { RestTimerBar } from "./components/RestTimerBar";
import { TabBar } from "./components/TabBar";
import { useRestSession } from "./hooks/useRestSession";
import { useRoute } from "./hooks/useRoute";
import type { Route } from "./lib/routes";
import { Exercises } from "./screens/Exercises";
import { History } from "./screens/History";
import { HistoryDetail } from "./screens/HistoryDetail";
import { NotificationCheck } from "./screens/NotificationCheck";
import { Placeholder } from "./screens/Placeholder";
import { Progress } from "./screens/Progress";
import { Settings } from "./screens/Settings";
import { Workout } from "./screens/Workout";

/** The app shell: the screen for the current URL above the bottom tab bar. */
export function App() {
	const route = useRoute();

	return (
		<RestSessionProvider>
			<main className="app">
				<Screen route={route} />
			</main>
			<TabBar active={route?.tab ?? null} />
		</RestSessionProvider>
	);
}

function Screen({ route }: { route: Route | null }) {
	const rest = useRestSession();
	switch (route?.name) {
		case "workout":
			return (
				<>
					<Workout onSetCompleted={rest.start} />
					<RestTimerBar />
				</>
			);
		case "history":
			return <History />;
		case "history-detail":
			return <HistoryDetail workoutId={route.workoutId} />;
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
