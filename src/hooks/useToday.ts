import { useEffect, useState } from "react";
import { formatLocalDay } from "../lib/bodyLog";

/**
 * Today's local day, "YYYY-MM-DD". Re-read when the page becomes visible or
 * gains focus, so a screen left open past midnight moves on to the new day
 * as soon as the user comes back to it.
 */
export function useToday(): string {
	const [today, setToday] = useState(() => formatLocalDay(Date.now()));
	useEffect(() => {
		const refresh = () => setToday(formatLocalDay(Date.now()));
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") refresh();
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("focus", refresh);
		window.addEventListener("pageshow", refresh);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("focus", refresh);
			window.removeEventListener("pageshow", refresh);
		};
	}, []);
	return today;
}
