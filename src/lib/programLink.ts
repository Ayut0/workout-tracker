import type { ProgramLink } from "../db/types";

/**
 * Where a workout sits in its program (ADR-0018), as shown under its name:
 * "Week 2 · Block 1", then " · Day A" when the link has a day, then
 * " · Deload" for a deload week. The program's name is not shown. Only the
 * active and past workout screens call this; no template screen does.
 */
export function describeProgramLink(link: ProgramLink): string {
	const parts = [`Week ${link.week}`, `Block ${link.block}`];
	if (link.day) parts.push(`Day ${link.day}`);
	if (link.deload) parts.push("Deload");
	return parts.join(" · ");
}
