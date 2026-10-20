/**
 * ID-token validation for the SIWC flow: RS256 signature against
 * OpenAI's published JWKS, plus issuer, audience (the issued client
 * id), expiry, and nonce checks. Implemented on `node:crypto` — no
 * JWT dependency. The verified `sub` is the account identity; email
 * alone never identifies or links an account.
 *
 * @module dsh-chatgpt-siwc/jwt
 */
import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { SiwcError } from "./errors.js";
let jwksCache;
const JWKS_TTL_MS = 10 * 60 * 1000;
/** Decode one JWT segment as JSON (no signature check). */
export function decodeSegment(segment) {
    const parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null)
        throw new SiwcError('JWT segment is not a JSON object', 'INVALID_ID_TOKEN');
    return parsed;
}
/** Split and decode a JWT's header + claims without trusting them. */
export function decodeJwt(token) {
    const parts = token.split('.');
    if (parts.length !== 3)
        throw new SiwcError('ID token is not a JWT', 'INVALID_ID_TOKEN');
    return { header: decodeSegment(parts[0]), claims: decodeSegment(parts[1]) };
}
async function fetchJwks(jwksUri, fetchFn) {
    const now = Date.now();
    if (jwksCache !== undefined && jwksCache.uri === jwksUri && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
        return jwksCache.keys;
    }
    const response = await fetchFn(jwksUri);
    if (!response.ok)
        throw new SiwcError(`JWKS fetch failed (HTTP ${response.status})`, 'JWKS_FETCH_FAILED');
    const body = (await response.json());
    if (!Array.isArray(body.keys))
        throw new SiwcError('JWKS document has no keys', 'JWKS_FETCH_FAILED');
    jwksCache = { uri: jwksUri, keys: body.keys, fetchedAt: now };
    return body.keys;
}
/**
 * Verify an ID token end to end.
 * @param token - the `id_token` from a token response.
 * @param options - JWKS URI, expected issuer/audience/nonce, clock skew, fetch.
 * @returns the validated identity claims.
 */
export async function verifyIdToken(token, options) {
    const fetchFn = options.fetchFn ?? fetch;
    const parts = token.split('.');
    if (parts.length !== 3)
        throw new SiwcError('ID token is not a JWT', 'INVALID_ID_TOKEN');
    const { header, claims } = decodeJwt(token);
    if (header['alg'] !== 'RS256') {
        throw new SiwcError(`ID token alg is ${String(header['alg'])}, expected RS256`, 'INVALID_ID_TOKEN');
    }
    const kid = header['kid'];
    if (typeof kid !== 'string')
        throw new SiwcError('ID token has no kid', 'INVALID_ID_TOKEN');
    let keys = await fetchJwks(options.jwksUri, fetchFn);
    let jwk = keys.find(key => key.kid === kid);
    if (jwk === undefined) {
        // Key rotation: one forced refetch before giving up.
        jwksCache = undefined;
        keys = await fetchJwks(options.jwksUri, fetchFn);
        jwk = keys.find(key => key.kid === kid);
    }
    if (jwk === undefined)
        throw new SiwcError(`no JWKS key for kid ${kid}`, 'INVALID_ID_TOKEN');
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
    const signature = Buffer.from(parts[2], 'base64url');
    const valid = cryptoVerify('RSA-SHA256', signingInput, publicKey, signature);
    if (!valid)
        throw new SiwcError('ID token signature does not verify', 'INVALID_ID_TOKEN');
    if (claims['iss'] !== options.issuer) {
        throw new SiwcError(`ID token issuer ${String(claims['iss'])} is not ${options.issuer}`, 'INVALID_ID_TOKEN');
    }
    const aud = claims['aud'];
    const audiences = Array.isArray(aud) ? aud : [aud];
    if (!audiences.includes(options.audience)) {
        throw new SiwcError('ID token audience does not match the issued client id', 'INVALID_ID_TOKEN');
    }
    const azp = claims['azp'];
    if (azp !== undefined && azp !== options.audience) {
        throw new SiwcError('ID token azp does not match the issued client id', 'INVALID_ID_TOKEN');
    }
    const exp = claims['exp'];
    if (typeof exp !== 'number' || exp * 1000 <= Date.now()) {
        throw new SiwcError('ID token is expired', 'INVALID_ID_TOKEN');
    }
    if (options.nonce !== undefined && claims['nonce'] !== options.nonce) {
        throw new SiwcError('ID token nonce does not match this sign-in attempt', 'INVALID_ID_TOKEN');
    }
    const sub = claims['sub'];
    if (typeof sub !== 'string' || sub.length === 0) {
        throw new SiwcError('ID token has no subject', 'INVALID_ID_TOKEN');
    }
    return {
        subject: sub,
        ...(typeof claims['email'] === 'string' ? { email: claims['email'] } : {}),
        ...(typeof claims['name'] === 'string' ? { name: claims['name'] } : {}),
        ...(typeof claims['picture'] === 'string' ? { picture: claims['picture'] } : {}),
    };
}
//# sourceMappingURL=jwt.js.map