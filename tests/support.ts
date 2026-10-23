/**
 * Shared fixtures for the OAuth and JWT suites: one RSA keypair, a JWKS
 * document for it, and an RS256 signer — all on node:crypto, no network.
 */
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto'

/** The test JWT signer and its JWKS document. */
export interface JwtHarness {
  /** The public key as a JWK (carries no `kid`). */
  readonly publicKeyJwk: Record<string, unknown>
  /** Sign claims as a JWT; `kid: false` omits the header `kid`. */
  signToken(claims: Record<string, unknown>, options?: { kid?: string | false; alg?: string }): string
  /** The JWKS document serving the public key under one `kid`. */
  jwksFor(kid: string): { keys: Record<string, unknown>[] }
}

/** Build the signer: one 2048-bit RSA keypair, private key never exposed. */
export function createJwtHarness(): JwtHarness {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const publicKeyJwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>
  const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url')
  return {
    publicKeyJwk,
    signToken(claims, options = {}) {
      const header: Record<string, unknown> = { alg: options.alg ?? 'RS256', typ: 'JWT' }
      if (options.kid !== false) header.kid = options.kid ?? 'test-kid'
      const signingInput = `${encode(header)}.${encode(claims)}`
      const signature = cryptoSign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url')
      return `${signingInput}.${signature}`
    },
    jwksFor(kid: string) {
      return { keys: [{ ...publicKeyJwk, kid, use: 'sig', alg: 'RS256' }] }
    },
  }
}

/** A JSON response for a faked endpoint. */
export function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
}

/** A temporary accounts store in a fresh directory. */
export { tempStore } from './store-fixture.ts'
