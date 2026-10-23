/**
 * Store fixtures shared across suites: temporary stores and a signed-in
 * account record, so no test touches a real Harness home.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ISSUER } from '../src/constants.ts'
import { AccountsStore, applyTokens } from '../src/store.ts'
import type { AccountRecord } from '../src/store.ts'

/** An isolated accounts store under a fresh temporary directory. */
export function tempStore(): AccountsStore {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-siwc-test-'))
  return new AccountsStore(join(dir, 'accounts.json'))
}

/** A validated sign-in record with live (never real) credentials. */
export function accountRecord(options: { clientId?: string; plan?: boolean; expiresIn?: number; subject?: string }): AccountRecord {
  const plan = options.plan !== false
  const record: AccountRecord = {
    email: 'user@example.com',
    issuer: ISSUER,
    subject: options.subject ?? 'sub-1',
    client_id: options.clientId ?? 'oaiapp_test',
    ext_agent_host_id: 'urn:uuid:00000000-0000-4000-8000-000000000000',
    scopes: plan ? ['openid', 'offline_access', 'chatgpt.tokens.use.direct'] : ['openid'],
    saved_at: new Date().toISOString(),
  }
  applyTokens(record, {
    access_token: 'at-1',
    refresh_token: 'rt-1',
    id_token: 'idt-1',
    token_type: 'bearer',
    expires_in: options.expiresIn ?? 3600,
    scope: plan ? 'openid offline_access chatgpt.tokens.use.direct' : 'openid',
  })
  return record
}

/** A store holding one signed-in account. */
export async function signedInStore(options: { plan?: boolean; expiresIn?: number } = {}): Promise<AccountsStore> {
  const store = tempStore()
  await store.saveSignIn(accountRecord(options))
  return store
}
