import { describe, expect, it } from "vitest";
import {
	createVapidJwt,
	decodeBase64Url,
	encodeBase64Url,
	type VapidKeys,
} from "./vapid";

async function makeKeys(): Promise<{ keys: VapidKeys; publicKey: CryptoKey }> {
	const pair = await crypto.subtle.generateKey(
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		["sign", "verify"],
	);
	if (!("publicKey" in pair)) throw new Error("Expected a key pair");
	const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
	if (!(raw instanceof ArrayBuffer)) throw new Error("Expected raw key bytes");
	const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
	if (privateJwk instanceof ArrayBuffer) throw new Error("Expected a JWK");
	return {
		keys: {
			publicKey: encodeBase64Url(raw),
			privateJwk,
			subject: "mailto:test@example.com",
		},
		publicKey: pair.publicKey,
	};
}

describe("base64url", () => {
	it("round-trips bytes without padding", () => {
		const bytes = new Uint8Array([0, 251, 255, 1, 2]);
		const encoded = encodeBase64Url(bytes);
		expect(encoded).not.toMatch(/[+/=]/);
		expect(Array.from(decodeBase64Url(encoded))).toEqual(Array.from(bytes));
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
			JSON.parse(new TextDecoder().decode(decodeBase64Url(header ?? ""))),
		).toEqual({
			typ: "JWT",
			alg: "ES256",
		});
		expect(
			JSON.parse(new TextDecoder().decode(decodeBase64Url(claims ?? ""))),
		).toEqual({
			aud: "https://web.push.apple.com",
			exp: 1_000 + 12 * 60 * 60,
			sub: "mailto:test@example.com",
		});

		const sig = decodeBase64Url(signature ?? "");
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
		const raw = decodeBase64Url(keys.publicKey);
		expect(raw.length).toBe(65);
		expect(raw[0]).toBe(0x04);
	});
});
