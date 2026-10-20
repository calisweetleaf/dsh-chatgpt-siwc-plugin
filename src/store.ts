/**
 * File-backed store for SIWC registrations and tokens.
 *
 * Layout under the Harness home (never anywhere near `~/.codex`):
 * - `chatgpt-siwc/accounts.json` (`0600`, dir `0700`): one credential
 *   record per issued client id. Registrations are never merged: one
 *   record's client id only ever travels with that record's tokens.
 * - `chatgpt-siwc/host.json`: this installation's stable
 *   `ext_agent_host_id` (`urn:uuid:…`). Not a secret.
 *
 * Writes are atomic and serialized through the cross-process writer lock
 * of `dsh-atomic-write`, so a rotating refresh token cannot be spent
 * twice by two processes. A group/world-readable accounts file is
 * refused on POSIX before its contents are read.
 *
 * @module dsh-chatgpt-siwc/store
 */

import { randomUUID } from 'node:crypto'
import { readFile, stat, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { ISSUER } from './constants.ts'

const FILE_MODE = 0o600
const DIR_MODE = 0o700

/** One ChatGPT account's registration + credential record (official record shape). */
export interface AccountRecord {
  email?: string
  name?: string
  picture?: string
  issuer: string
  /** Validated ID-token subject; the account identity (with client_id). */
  subject: string
  /** The issued `oaiapp_…` client id from the registration callback. */
  client_id: string
  ext_agent_host_id: string
  id_token?: string
  access_token?: string
  refresh_token?: string
  token_type?: string
  /** Access-token lifetime in seconds, as issued. */
  expires_in?: number
  /** Absolute access-token expiry (epoch ms), computed at save time. */
  expires_at?: number
  /** Granted scopes from the latest token response. */
  scopes: string[]
  /** UTC timestamp of the latest token response. */
  saved_at: string
  /** Last model catalog this account returned (slug + display name), for offline pickers. */
  models?: { slug: string; displayName: string }[]
}

/** The accounts document. */
export interface AccountsDocument {
  version: 1
  /** Client id of the account new requests use. */
  activeClientId?: string
  /** Whether the one-time first-sign-in welcome has been shown. */
  welcomed?: boolean
  accounts: Record<string, AccountRecord>
}

/** Token fields replaced together on exchange/refresh (rotation is atomic). */
export interface TokenSet {
  access_token: string
  refresh_token?: string
  id_token?: string
  token_type?: string
  expires_in?: number
  scope?: string
}

/** Default location of the accounts document. */
export function defaultStorePath(): string {
  return dshHomePath('chatgpt-siwc', 'accounts.json')
}

/** Split a space-separated scope string into a list. */
export function parseScopes(scope: string | undefined): string[] {
  return scope === undefined ? [] : scope.split(/\s+/u).filter(part => part.length > 0)
}

export class AccountsStore {
  constructor(readonly path: string = defaultStorePath()) {}

  /** The sibling file holding this host's stable id. */
  get hostPath(): string {
    return join(dirname(this.path), 'host.json')
  }

  private async ensureDir(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: DIR_MODE })
  }

  /** Read and validate the document; a missing file is an empty document. */
  async readDocument(): Promise<AccountsDocument> {
    let text: string
    try {
      text = await readFile(this.path, 'utf8')
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') {
        return { version: 1, accounts: {} }
      }
      throw error
    }
    if (process.platform !== 'win32') {
      const mode = (await stat(this.path)).mode
      if ((mode & 0o077) !== 0) {
        throw new Error(
          `dsh-chatgpt-siwc: credential store ${this.path} is readable by other users;`
          + ' run `chmod 600` on it (it holds your ChatGPT OAuth tokens)',
        )
      }
    }
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`dsh-chatgpt-siwc: credential store at ${this.path} is not a JSON object`)
    }
    const doc = parsed as AccountsDocument
    if (typeof doc.accounts !== 'object' || doc.accounts === null) doc.accounts = {}
    return doc
  }

  private async writeDocument(document: AccountsDocument): Promise<void> {
    await writeFileAtomic(this.path, `${JSON.stringify(document, null, 2)}\n`, {
      mode: FILE_MODE,
      dirMode: DIR_MODE,
    })
  }

  /** Run one read-modify-write under the cross-process lock. */
  async modify<T>(fn: (doc: AccountsDocument) => Promise<T> | T): Promise<T> {
    await this.ensureDir()
    return withFileLock(this.path, async () => {
      const doc = await this.readDocument()
      const result = await fn(doc)
      await this.writeDocument(doc)
      return result
    })
  }

  /**
   * This host's stable `ext_agent_host_id`, created on first use and the
   * same for every later sign-in from this installation.
   */
  async hostId(): Promise<string> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.hostPath, 'utf8'))
      const id = (parsed as { ext_agent_host_id?: unknown }).ext_agent_host_id
      if (typeof id === 'string' && id.startsWith('urn:uuid:')) return id
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException | null)?.code !== 'ENOENT') throw error
    }
    const id = `urn:uuid:${randomUUID()}`
    await this.ensureDir()
    await writeFileAtomic(this.hostPath, `${JSON.stringify({ ext_agent_host_id: id }, null, 2)}\n`, {
      mode: FILE_MODE,
      dirMode: DIR_MODE,
    })
    return id
  }

  /** All account records (full records — callers must never log tokens). */
  async accounts(): Promise<AccountRecord[]> {
    return Object.values((await this.readDocument()).accounts)
  }

  /** One account by its issued client id. */
  async account(clientId: string): Promise<AccountRecord | undefined> {
    return (await this.readDocument()).accounts[clientId]
  }

  /** The active account, if any registration exists. */
  async active(): Promise<AccountRecord | undefined> {
    const doc = await this.readDocument()
    if (doc.activeClientId !== undefined) return doc.accounts[doc.activeClientId]
    return Object.values(doc.accounts)[0]
  }

  /** Whether the one-time welcome has already been shown. */
  async welcomed(): Promise<boolean> {
    return (await this.readDocument()).welcomed === true
  }

  /** Record that the one-time welcome has been shown. */
  async markWelcomed(): Promise<void> {
    await this.modify((doc) => { doc.welcomed = true })
  }

  /**
   * Insert or replace one account's identity + tokens after a validated
   * sign-in, and make it the active account.
   */
  async saveSignIn(record: AccountRecord): Promise<void> {
    await this.modify((doc) => {
      doc.accounts[record.client_id] = record
      doc.activeClientId = record.client_id
    })
  }

  /**
   * Replace one account's token set after a refresh. The access token,
   * expiry, scopes, and rotated refresh token move together — never
   * one without the others.
   */
  async saveTokens(clientId: string, tokens: TokenSet): Promise<AccountRecord> {
    return this.modify((doc) => {
      const account = doc.accounts[clientId]
      if (account === undefined) {
        throw new Error(`dsh-chatgpt-siwc: no registration for client id ${clientId}`)
      }
      applyTokens(account, tokens)
      return account
    })
  }

  /**
   * Sign one account out locally: tokens are cleared, the registration
   * (client id + identity + host id) is kept so a later sign-in can
   * reauthorize without re-registering.
   */
  async clearTokens(clientId: string): Promise<void> {
    await this.modify((doc) => {
      const account = doc.accounts[clientId]
      if (account === undefined) return
      delete account.access_token
      delete account.refresh_token
      delete account.id_token
      delete account.expires_in
      delete account.expires_at
      account.scopes = []
      account.saved_at = new Date().toISOString()
    })
  }

  /** Delete one registration entirely (sign-out with purge). */
  async remove(clientId: string): Promise<void> {
    await this.modify((doc) => {
      delete doc.accounts[clientId]
      if (doc.activeClientId === clientId) delete doc.activeClientId
    })
  }

  /** Choose which registered account new requests use. */
  async setActive(clientId: string): Promise<void> {
    await this.modify((doc) => {
      if (doc.accounts[clientId] === undefined) {
        throw new Error(`dsh-chatgpt-siwc: no registration for client id ${clientId}`)
      }
      doc.activeClientId = clientId
    })
  }

  /** Cache one account's model catalog for offline pickers. */
  async saveModels(clientId: string, models: { slug: string; displayName: string }[]): Promise<void> {
    await this.modify((doc) => {
      const account = doc.accounts[clientId]
      if (account !== undefined) account.models = models
    })
  }
}

/** Apply one token response onto a record, computing the absolute expiry. */
export function applyTokens(account: AccountRecord, tokens: TokenSet): void {
  account.access_token = tokens.access_token
  if (tokens.refresh_token !== undefined) account.refresh_token = tokens.refresh_token
  if (tokens.id_token !== undefined) account.id_token = tokens.id_token
  if (tokens.token_type !== undefined) account.token_type = tokens.token_type
  account.expires_in = tokens.expires_in
  account.expires_at = tokens.expires_in === undefined
    ? undefined
    : Date.now() + tokens.expires_in * 1000
  const scopes = parseScopes(tokens.scope)
  if (scopes.length > 0) account.scopes = scopes
  account.saved_at = new Date().toISOString()
  if (account.issuer === undefined) account.issuer = ISSUER
}

/** Whether a record currently holds usable credentials. */
export function isSignedIn(account: AccountRecord | undefined): account is AccountRecord {
  return account !== undefined
    && typeof account.access_token === 'string' && account.access_token.length > 0
    && typeof account.refresh_token === 'string' && account.refresh_token.length > 0
}

/** Whether the record's granted scopes include plan usage. */
export function planGranted(account: AccountRecord | undefined): boolean {
  return account !== undefined && account.scopes.includes('chatgpt.tokens.use.direct')
}

/** A token-free view of one account, safe to print. */
export function publicView(account: AccountRecord): Record<string, unknown> {
  return {
    email: account.email,
    name: account.name,
    subject: account.subject,
    client_id: account.client_id,
    signed_in: isSignedIn(account),
    plan_granted: planGranted(account),
    scopes: account.scopes,
    access_token_expires_at: account.expires_at === undefined
      ? undefined
      : new Date(account.expires_at).toISOString(),
    saved_at: account.saved_at,
  }
}
