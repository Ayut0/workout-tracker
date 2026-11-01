/**
 * Records stored on the device in IndexedDB.
 *
 * Phase 1 only needs the rest-timer log. Exercises, templates, workouts and
 * sets arrive with the Strong import in phase 2.
 */

/**
 * One rest-timer notification, kept so we can measure how late the
 * lock-screen notification arrives. The service worker fills in receivedAt.
 */
export interface RestTimer {
	id: string;
	/** When the notification should fire (epoch ms). */
	scheduledAt: number;
	createdAt: number;
	status: "pending" | "received" | "cancelled" | "failed";
	receivedAt?: number;
	error?: string;
}
