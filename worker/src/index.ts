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

function vapidKeys(env: Env): VapidKeys {
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
			const result = await sendEmptyPush(endpoint, vapidKeys(this.env));
			if (result.status >= 300) {
				console.error(`Push failed with HTTP ${result.status}`);
			}
		} catch (error) {
			console.error("Push request failed", error);
		}
		// One timer, one push: forget the endpoint either way.
		await this.ctx.storage.deleteAll();
	}
}

function corsHeaders(env: Env): HeadersInit {
	return {
		"Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
		"Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};
}

function json(env: Env, status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...corsHeaders(env) },
	});
}

async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return undefined;
	}
}

function timerFor(env: Env, endpoint: string): DurableObjectStub<RestTimer> {
	return env.REST_TIMER.get(env.REST_TIMER.idFromName(endpoint));
}

export default {
	async fetch(request, env): Promise<Response> {
		const { pathname } = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders(env) });
		}
		if (pathname === "/health" && request.method === "GET") {
			return json(env, 200, { ok: true });
		}
		if (pathname !== "/timers") {
			return json(env, 404, { error: "Not found" });
		}
		if (request.headers.get("Origin") !== env.ALLOWED_ORIGIN) {
			return json(env, 403, { error: "Origin not allowed" });
		}

		if (request.method === "POST") {
			const parsed = parseScheduleRequest(await readJson(request), Date.now());
			if (!parsed.ok) return json(env, 400, { error: parsed.error });
			await timerFor(env, parsed.value.endpoint).schedule(
				parsed.value.endpoint,
				parsed.value.fireAt,
			);
			return json(env, 202, { fireAt: parsed.value.fireAt });
		}

		if (request.method === "DELETE") {
			const parsed = parseCancelRequest(await readJson(request));
			if (!parsed.ok) return json(env, 400, { error: parsed.error });
			await timerFor(env, parsed.value.endpoint).cancel();
			return json(env, 200, { cancelled: true });
		}

		return json(env, 405, { error: "Method not allowed" });
	},
} satisfies ExportedHandler<Env>;
