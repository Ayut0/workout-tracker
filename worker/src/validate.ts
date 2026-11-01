/**
 * Request validation. The worker only ever POSTs to push services it knows,
 * so a request cannot make it call an arbitrary URL.
 */

const PUSH_HOSTS = [
	"web.push.apple.com",
	"fcm.googleapis.com",
	"updates.push.services.mozilla.com",
];
const PUSH_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

export const MIN_DELAY_MS = 5_000;
export const MAX_DELAY_MS = 60 * 60 * 1000;

export function isAllowedPushEndpoint(endpoint: string): boolean {
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return false;
	}
	if (url.protocol !== "https:") return false;
	return (
		PUSH_HOSTS.includes(url.hostname) ||
		PUSH_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))
	);
}

export interface ScheduleRequest {
	endpoint: string;
	fireAt: number;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function readEndpoint(body: unknown): Parsed<string> {
	if (typeof body !== "object" || body === null) {
		return { ok: false, error: "Body must be a JSON object" };
	}
	const endpoint = (body as { endpoint?: unknown }).endpoint;
	if (typeof endpoint !== "string" || !isAllowedPushEndpoint(endpoint)) {
		return {
			ok: false,
			error: "endpoint must be an https URL of a known push service",
		};
	}
	return { ok: true, value: endpoint };
}

export function parseScheduleRequest(
	body: unknown,
	now: number,
): Parsed<ScheduleRequest> {
	const endpoint = readEndpoint(body);
	if (!endpoint.ok) return endpoint;
	const fireAt = (body as { fireAt?: unknown }).fireAt;
	if (typeof fireAt !== "number" || !Number.isFinite(fireAt)) {
		return { ok: false, error: "fireAt must be epoch milliseconds" };
	}
	const delay = fireAt - now;
	if (delay < MIN_DELAY_MS || delay > MAX_DELAY_MS) {
		return {
			ok: false,
			error: "fireAt must be between 5 seconds and 1 hour from now",
		};
	}
	return { ok: true, value: { endpoint: endpoint.value, fireAt } };
}

export function parseCancelRequest(
	body: unknown,
): Parsed<{ endpoint: string }> {
	const endpoint = readEndpoint(body);
	return endpoint.ok
		? { ok: true, value: { endpoint: endpoint.value } }
		: endpoint;
}
