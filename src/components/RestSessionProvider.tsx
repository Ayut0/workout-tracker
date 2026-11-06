import type { ReactNode } from "react";
import {
	RestSessionContext,
	useRestSessionOwner,
} from "../hooks/useRestSession";

/** Holds the rest timer above the screens, so it survives tab switches. */
export function RestSessionProvider({ children }: { children: ReactNode }) {
	const value = useRestSessionOwner();
	return <RestSessionContext value={value}>{children}</RestSessionContext>;
}
