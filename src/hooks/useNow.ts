import { useEffect, useState } from "react";

/**
 * The current time (epoch ms), refreshed every `intervalMs` and as soon as the
 * page becomes visible again (timers are throttled or frozen while hidden).
 */
export function useNow(intervalMs: number): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const refresh = () => setNow(Date.now());
		const onVisible = () => {
			if (document.visibilityState === "visible") refresh();
		};
		const id = window.setInterval(refresh, intervalMs);
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			window.clearInterval(id);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [intervalMs]);
	return now;
}
