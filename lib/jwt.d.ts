/**
 * ID-token validation for the SIWC flow: RS256 signature against
 * OpenAI's published JWKS, plus issuer, audience (the issued client
 * id), expiry, and nonce checks. Implemented on `node:crypto` — no
 * JWT dependency. The verified `sub` is the account identity; email
 * alone never identifies or links an account.
 *
 * @module dsh-chatgpt-siwc/jwt
 */
/** Decode one JWT segment as JSON (no signature check). */
export declare function decodeSegment(segment: string): Record<string, unknown>;
/** Split and decode a JWT's header + claims without trusting them. */
export declare function decodeJwt(token: string): {
    header: Record<string, unknown>;
    claims: Record<string, unknown>;
};
/** The validated identity claims this plugin relies on. */
export interface IdTokenIdentity {
    subject: string;
    email?: string;
    name?: string;
    picture?: string;
}
/**
 * Verify an ID token end to end.
 * @param token - the `id_token` from a token response.
 * @param options - JWKS URI, expected issuer/audience/nonce, clock skew, fetch.
 * @returns the validated identity claims.
 */
export declare function verifyIdToken(token: string, options: {
    jwksUri: string;
    issuer: string;
    audience: string;
    nonce?: string;
    fetchFn?: typeof fetch;
}): Promise<IdTokenIdentity>;
