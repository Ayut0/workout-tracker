// Generates a VAPID key pair for Web Push.
// Usage: pnpm --filter worker vapid
import { webcrypto as crypto } from "node:crypto";

const toBase64Url = (bytes) => Buffer.from(bytes).toString("base64url");

const { publicKey, privateKey } = await crypto.subtle.generateKey(
	{ name: "ECDSA", namedCurve: "P-256" },
	true,
	["sign", "verify"],
);
const rawPublic = new Uint8Array(
	await crypto.subtle.exportKey("raw", publicKey),
);
const privateJwk = await crypto.subtle.exportKey("jwk", privateKey);

console.log("Public key (VITE_VAPID_PUBLIC_KEY and VAPID_PUBLIC_KEY):");
console.log(toBase64Url(rawPublic));
console.log(
	"\nPrivate key (paste into `wrangler secret put VAPID_PRIVATE_JWK`, keep it secret):",
);
console.log(JSON.stringify(privateJwk));
