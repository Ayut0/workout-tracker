import { DurableObject } from "cloudflare:workers";
import { parseCancelRequest, parseScheduleRequest } from "./validate";
import { sendEmptyPush, type VapidKeys } from "./vapid";

export interface Env {
	REST_TIMER: DurableObjectNamespace<RestTimer>;
	/** Origin of the PWA, e.g. https://workout-tracker.pages.dev */
	ALLOWED_ORIGIN: string;
	VAPID_PUBLIC_KEY: string;
	VAPID_SUBJECT: string;
	/** Secret: the private key JWK as a JSON string. */
	VAPID_PRIVATE_JWK: string;
}

const ROUTES = { timers: "/timers", health: "/health" } as const;
const METHODS = {
	get: "GET",
	post: "POST",
	delete: "DELETE",
	options: "OPTIONS",
} as const;

function loadVapidKeys(env: Env): VapidKeys {
	return {
		publicKey: env.VAPID_PUBLIC_KEY,
		privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK) as JsonWebKey,
		subject: env.VAPID_SUBJECT,
	};
}

/**
 * One instance per device (keyed by its push endpoint). It holds at most one
 * pending rest timer: scheduling again replaces it.
 *
 * Stores only the push endpoint and the fire time, never workout data.
 */
export class RestTimer extends DurableObject<Env> {
	async schedule(endpoint: string, fireAt: number): Promise<void> {
		await this.ctx.storage.put({ endpoint, fireAt });
		await this.ctx.storage.setAlarm(fireAt);
	}

	async cancel(): Promise<void> {
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.deleteAll();
	}

	override async alarm(): Promise<void> {
		const endpoint = await this.ctx.storage.get<string>("endpoint");
		if (!endpoint) return;
		// Never throw from here: a thrown alarm is retried later, and a late
		// "rest is over" is worse than none.
		try {
			const result = await sendEmptyPush(endpoint, loadVapidKeys(this.env));
			if (!result.ok) {
				console.error(`Push failed with HTTP ${result.status}`);
			}
		} catch (error) {
			console.error("Push request failed", error);
		}
		// One timer, one push: forget the endpoint either way.
		await this.ctx.storage.deleteAll();
	}
}

function buildCorsHeaders(env: Env): HeadersInit {
	return {
		"Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
		"Access-Control-Allow-Methods": [
			METHODS.post,
			METHODS.delete,
			METHODS.options,
		].join(", "),
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};
}

function createJsonResponse(env: Env, status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...buildCorsHeaders(env) },
	});
}

async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return undefined;
	}
}

function getTimerStub(env: Env, endpoint: string): DurableObjectStub<RestTimer> {
	return env.REST_TIMER.get(env.REST_TIMER.idFromName(endpoint));
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
	const { pathname } = new URL(request.url);

	if (request.method === METHODS.options) {
		return new Response(null, { status: 204, headers: buildCorsHeaders(env) });
	}
	if (pathname === ROUTES.health && request.method === METHODS.get) {
		return createJsonResponse(env, 200, { ok: true });
	}
	if (pathname !== ROUTES.timers) {
		return createJsonResponse(env, 404, { error: "Not found" });
	}
	if (request.headers.get("Origin") !== env.ALLOWED_ORIGIN) {
		return createJsonResponse(env, 403, { error: "Origin not allowed" });
	}

	if (request.method === METHODS.post) {
		const parsed = parseScheduleRequest(await readJson(request), Date.now());
		if (!parsed.ok) return createJsonResponse(env, 400, { error: parsed.error });
		await getTimerStub(env, parsed.value.endpoint).schedule(
			parsed.value.endpoint,
			parsed.value.fireAt,
		);
		return createJsonResponse(env, 202, { fireAt: parsed.value.fireAt });
	}

	if (request.method === METHODS.delete) {
		const parsed = parseCancelRequest(await readJson(request));
		if (!parsed.ok) return createJsonResponse(env, 400, { error: parsed.error });
		await getTimerStub(env, parsed.value.endpoint).cancel();
		return createJsonResponse(env, 200, { cancelled: true });
	}

	return createJsonResponse(env, 405, { error: "Method not allowed" });
}

// Workers entry point: the runtime calls the default export's `fetch`.
export default { fetch: handleRequest } satisfies ExportedHandler<Env>;
