import { describe, expect, it } from "vitest";
import {
	base64UrlDecode,
	base64UrlEncode,
	createVapidJwt,
	type VapidKeys,
} from "./vapid";

async function makeKeys(): Promise<{ keys: VapidKeys; publicKey: CryptoKey }> {
	const pair = (await crypto.subtle.generateKey(
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		["sign", "verify"],
	)) as CryptoKeyPair;
	const raw = (await crypto.subtle.exportKey(
		"raw",
		pair.publicKey,
	)) as ArrayBuffer;
	const privateJwk = (await crypto.subtle.exportKey(
		"jwk",
		pair.privateKey,
	)) as JsonWebKey;
	return {
		keys: {
			publicKey: base64UrlEncode(raw),
			privateJwk,
			subject: "mailto:test@example.com",
		},
		publicKey: pair.publicKey,
	};
}

describe("base64url", () => {
	it("round-trips bytes without padding", () => {
		const bytes = new Uint8Array([0, 251, 255, 1, 2]);
		const encoded = base64UrlEncode(bytes);
		expect(encoded).not.toMatch(/[+/=]/);
		expect(Array.from(base64UrlDecode(encoded))).toEqual(Array.from(bytes));
	});
});

describe("createVapidJwt", () => {
	it("signs a JWT whose ES256 signature verifies with the public key", async () => {
		const { keys, publicKey } = await makeKeys();
		const jwt = await createVapidJwt(
			"https://web.push.apple.com/QGuQyavXutnMbf3Q",
			keys,
			1_000,
		);
		const [header, claims, signature] = jwt.split(".");

		expect(
			JSON.parse(new TextDecoder().decode(base64UrlDecode(header ?? ""))),
		).toEqual({
			typ: "JWT",
			alg: "ES256",
		});
		expect(
			JSON.parse(new TextDecoder().decode(base64UrlDecode(claims ?? ""))),
		).toEqual({
			aud: "https://web.push.apple.com",
			exp: 1_000 + 12 * 60 * 60,
			sub: "mailto:test@example.com",
		});

		const sig = base64UrlDecode(signature ?? "");
		expect(sig.length).toBe(64);
		const valid = await crypto.subtle.verify(
			{ name: "ECDSA", hash: "SHA-256" },
			publicKey,
			sig,
			new TextEncoder().encode(`${header}.${claims}`),
		);
		expect(valid).toBe(true);
	});

	it("exports a 65-byte uncompressed public key", async () => {
		const { keys } = await makeKeys();
		const raw = base64UrlDecode(keys.publicKey);
		expect(raw.length).toBe(65);
		expect(raw[0]).toBe(0x04);
	});
});
