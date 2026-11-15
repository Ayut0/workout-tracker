import type { ProgramLink } from "../db/types";

/**
 * Where a workout or template sits in its program (ADR-0018), as shown under
 * its name: "Week 2 · Block 1", with " · Deload" for a deload week.
 */
export function describeProgramLink(link: ProgramLink): string {
	const place = `Week ${link.week} · Block ${link.block}`;
	return link.deload ? `${place} · Deload` : place;
}
