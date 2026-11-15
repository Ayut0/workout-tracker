/**
 * Warm-up sets (#65, ADR-0012): marked by hand with the "W" toggle on a set
 * or planned set. Only `true` is stored; clearing the mark deletes the field,
 * so a working set looks as it did before warm-ups existed.
 */

/** The warm-up mark after the "W" toggle is tapped; undefined clears it. */
export function toggleWarmup(warmup: boolean | undefined): true | undefined {
	return warmup ? undefined : true;
}
