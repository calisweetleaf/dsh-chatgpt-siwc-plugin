/**
 * ID-token verification: RS256 against a test JWKS, plus the issuer,
 * audience, expiry, nonce, and key-rotation checks that make the verified
 * `sub` trustworthy.
 */
import { describe, expect, it, vi } from 'vitest'
import { ISSUER } from '../src/constants.ts'
import { verifyIdToken } from '../src/jwt.ts'
import { createJwtHarness, jsonResponse } from './support.ts'

const harness = createJwtHarness()
const claims = {
  iss: ISSUER,
  aud: 'oaiapp_test',
  sub: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  exp: Math.floor(Date.now() / 1000) + 600,
  nonce: 'nonce-1',
}

function verify(options: { token: string; nonce?: string; uri?: string; fetchFn?: typeof fetch }) {
  const uri = options.uri ?? 'https://jwks.test/keys'
  return verifyIdToken(options.token, {
    jwksUri: uri,
    issuer: ISSUER,
    audience: 'oaiapp_test',
    ...(options.nonce === undefined ? {} : { nonce: options.nonce }),
    ...(options.fetchFn === undefined ? {} : { fetchFn: options.fetchFn }),
  })
}

const serveJwks = async (): Promise<Response> => jsonResponse(harness.jwksFor('test-kid'))

describe('verifyIdToken', () => {
  it('returns the validated identity claims for a good token', async () => {
    await expect(verify({ token: harness.signToken(claims), fetchFn: serveJwks, nonce: 'nonce-1' }))
      .resolves.toEqual({ subject: 'user-1', email: 'user@example.com', name: 'Test User' })
  })

  it('rejects a nonce that did not originate this sign-in', async () => {
    await expect(verify({ token: harness.signToken(claims), fetchFn: serveJwks, nonce: 'other' }))
      .rejects.toMatchObject({ code: 'INVALID_ID_TOKEN', message: expect.stringContaining('nonce') })
  })

  it('rejects an expired token', async () => {
    await expect(verify({ token: harness.signToken({ ...claims, exp: Math.floor(Date.now() / 1000) - 60 }), fetchFn: serveJwks }))
      .rejects.toMatchObject({ code: 'INVALID_ID_TOKEN', message: expect.stringContaining('expired') })
  })

  it('rejects an audience other than the issued client id', async () => {
    await expect(verify({ token: harness.signToken({ ...claims, aud: 'someone-else' }), fetchFn: serveJwks }))
      .rejects.toMatchObject({ code: 'INVALID_ID_TOKEN', message: expect.stringContaining('audience') })
  })

  it('rejects an azp other than the issued client id', async () => {
    const token = harness.signToken({ ...claims, aud: ['oaiapp_test', 'other-app'], azp: 'other-app' })
    await expect(verify({ token, fetchFn: serveJwks }))
      .rejects.toMatchObject({ code: 'INVALID_ID_TOKEN', message: expect.stringContaining('azp') })
  })

  it('rejects a tampered signature', async () => {
    const token = harness.signToken(claims)
    const parts = token.split('.')
    const signature = Buffer.from(parts[2]!, 'base64url')
    signature[0] ^= 0xff
    await expect(verify({ token: `${parts[0]}.${parts[1]}.${signature.toString('base64url')}`, fetchFn: serveJwks }))
      .rejects.toMatchObject({ code: 'INVALID_ID_TOKEN', message: expect.stringContaining('signature') })
  })

  it('rejects any algorithm but RS256', async () => {
    await expect(verify({ token: harness.signToken(claims, { alg: 'HS256' }), fetchFn: serveJwks }))
      .rejects.toMatchObject({ code: 'INVALID_ID_TOKEN', message: expect.stringContaining('alg') })
  })

  it('rejects a token with no key id', async () => {
    await expect(verify({ token: harness.signToken(claims, { kid: false }), fetchFn: serveJwks }))
      .rejects.toMatchObject({ code: 'INVALID_ID_TOKEN', message: expect.stringContaining('kid') })
  })

  it('refetches JWKS once when the key rotated', async () => {
    const fetchFn = vi.fn(async (): Promise<Response> => {
      if (fetchFn.mock.calls.length === 1) return jsonResponse({ keys: [] })
      return jsonResponse(harness.jwksFor('rotated-kid'))
    })
    await expect(verify({ token: harness.signToken(claims, { kid: 'rotated-kid' }), uri: 'https://jwks.test/rotated', fetchFn }))
      .resolves.toMatchObject({ subject: 'user-1' })
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('fails when JWKS cannot be read', async () => {
    await expect(verify({ token: harness.signToken(claims), fetchFn: async () => new Response(null, { status: 500 }) }))
      .rejects.toMatchObject({ code: 'JWKS_FETCH_FAILED' })
  })
})
