import { useState } from "react";
import { HistoryRow } from "../components/history/HistoryRow";
import type { HistoryCursor } from "../db/history";
import type { WeightUnit } from "../db/types";
import { useSettings } from "../hooks/useSettings";
import { useHistoryPage } from "../hooks/useWorkoutHistory";

/**
 * The History tab: finished workouts, newest first, one page at a time.
 * Each page is its own live query along the `startedAt` index, so years of
 * imported workouts never load at once.
 */
export function History() {
	const { settings, loaded } = useSettings();
	const [pageCount, setPageCount] = useState(1);
	return (
		<>
			<header className="head">
				<h1>History</h1>
				<p className="lead">Your finished workouts, newest first.</p>
			</header>
			{/* Wait for the weight unit, so volumes never flash in kg before lb. */}
			{loaded && (
				<ol className="history-list">
					<HistoryPageRows
						after={undefined}
						pagesLeft={pageCount}
						weightUnit={settings.weightUnit}
						onLoadMore={() => setPageCount((count) => count + 1)}
					/>
				</ol>
			)}
		</>
	);
}

type HistoryPageRowsProps = {
	after: HistoryCursor | undefined;
	/** Pages to show from this one on, this one included. */
	pagesLeft: number;
	weightUnit: WeightUnit;
	onLoadMore: () => void;
};

/**
 * One page's rows, then the next page or a "Load more" button. The next page
 * starts after this page's live last row, so a delete or a moved start never
 * skips or repeats a workout across pages.
 */
function HistoryPageRows({
	after,
	pagesLeft,
	weightUnit,
	onLoadMore,
}: HistoryPageRowsProps) {
	const page = useHistoryPage(after);
	if (!page) return null;
	if (after === undefined && page.entries.length === 0) {
		return (
			<li className="empty">
				No finished workouts yet. Finish one on the Workout tab, or import your
				Strong history in Settings.
			</li>
		);
	}
	return (
		<>
			{page.entries.map((entry) => (
				<HistoryRow
					key={entry.workout.id}
					entry={entry}
					weightUnit={weightUnit}
				/>
			))}
			{page.next !== undefined &&
				(pagesLeft > 1 ? (
					<HistoryPageRows
						after={page.next}
						pagesLeft={pagesLeft - 1}
						weightUnit={weightUnit}
						onLoadMore={onLoadMore}
					/>
				) : (
					<li className="history-more">
						<button type="button" className="secondary" onClick={onLoadMore}>
							Load more
						</button>
					</li>
				))}
		</>
	);
}
