/**
 * Minimal Web Push sender for Cloudflare Workers, using WebCrypto only.
 *
 * Pushes are sent without a payload. The service worker already knows what to
 * show ("rest is over"), so no workout data and no payload encryption are needed:
 * the push service only learns that this device should be woken now.
 */

export interface VapidKeys {
	/** Uncompressed P-256 public key (65 bytes), base64url. */
	publicKey: string;
	/** Private key as a JWK (kty EC, crv P-256, with d). */
	privateJwk: JsonWebKey;
	/** Contact for the push service: "mailto:you@example.com" or an https URL. */
	subject: string;
}

const JWT_LIFETIME_SEC = 12 * 60 * 60;

export function base64UrlEncode(
	input: ArrayBuffer | Uint8Array | string,
): string {
	const bytes =
		typeof input === "string"
			? new TextEncoder().encode(input)
			: input instanceof Uint8Array
				? input
				: new Uint8Array(input);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export function base64UrlDecode(input: string): Uint8Array {
	const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/** Signs a VAPID JWT for the push service that owns `endpoint`. */
export async function createVapidJwt(
	endpoint: string,
	keys: VapidKeys,
	nowSec: number = Math.floor(Date.now() / 1000),
): Promise<string> {
	const header = base64UrlEncode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
	const claims = base64UrlEncode(
		JSON.stringify({
			aud: new URL(endpoint).origin,
			exp: nowSec + JWT_LIFETIME_SEC,
			sub: keys.subject,
		}),
	);
	const signingInput = `${header}.${claims}`;
	const key = await crypto.subtle.importKey(
		"jwk",
		keys.privateJwk,
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);
	// WebCrypto returns r||s (64 bytes), which is exactly the JWS ES256 format.
	const signature = await crypto.subtle.sign(
		{ name: "ECDSA", hash: "SHA-256" },
		key,
		new TextEncoder().encode(signingInput),
	);
	return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function vapidAuthorization(
	endpoint: string,
	keys: VapidKeys,
): Promise<string> {
	const jwt = await createVapidJwt(endpoint, keys);
	return `vapid t=${jwt}, k=${keys.publicKey}`;
}

export interface PushResult {
	status: number;
}

export async function sendEmptyPush(
	endpoint: string,
	keys: VapidKeys,
): Promise<PushResult> {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			Authorization: await vapidAuthorization(endpoint, keys),
			// Drop the push if it cannot be delivered within a minute: a late
			// "rest is over" is worse than none.
			TTL: "60",
			Urgency: "high",
		},
	});
	return { status: response.status };
}
