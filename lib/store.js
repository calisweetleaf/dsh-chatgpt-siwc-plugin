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
import { randomUUID } from 'node:crypto';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { ISSUER } from "./constants.js";
const FILE_MODE = 0o600;
const DIR_MODE = 0o700;
/** Default location of the accounts document. */
export function defaultStorePath() {
    return dshHomePath('chatgpt-siwc', 'accounts.json');
}
/** Split a space-separated scope string into a list. */
export function parseScopes(scope) {
    return scope === undefined ? [] : scope.split(/\s+/u).filter(part => part.length > 0);
}
export class AccountsStore {
    path;
    constructor(path = defaultStorePath()) {
        this.path = path;
    }
    /** The sibling file holding this host's stable id. */
    get hostPath() {
        return join(dirname(this.path), 'host.json');
    }
    async ensureDir() {
        await mkdir(dirname(this.path), { recursive: true, mode: DIR_MODE });
    }
    /** Read and validate the document; a missing file is an empty document. */
    async readDocument() {
        let text;
        try {
            text = await readFile(this.path, 'utf8');
        }
        catch (error) {
            if (error?.code === 'ENOENT') {
                return { version: 1, accounts: {} };
            }
            throw error;
        }
        if (process.platform !== 'win32') {
            const mode = (await stat(this.path)).mode;
            if ((mode & 0o077) !== 0) {
                throw new Error(`dsh-chatgpt-siwc: credential store ${this.path} is readable by other users;`
                    + ' run `chmod 600` on it (it holds your ChatGPT OAuth tokens)');
            }
        }
        const parsed = JSON.parse(text);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error(`dsh-chatgpt-siwc: credential store at ${this.path} is not a JSON object`);
        }
        const doc = parsed;
        if (typeof doc.accounts !== 'object' || doc.accounts === null)
            doc.accounts = {};
        return doc;
    }
    async writeDocument(document) {
        await writeFileAtomic(this.path, `${JSON.stringify(document, null, 2)}\n`, {
            mode: FILE_MODE,
            dirMode: DIR_MODE,
        });
    }
    /** Run one read-modify-write under the cross-process lock. */
    async modify(fn) {
        await this.ensureDir();
        return withFileLock(this.path, async () => {
            const doc = await this.readDocument();
            const result = await fn(doc);
            await this.writeDocument(doc);
            return result;
        });
    }
    /**
     * This host's stable `ext_agent_host_id`, created on first use and the
     * same for every later sign-in from this installation.
     */
    async hostId() {
        try {
            const parsed = JSON.parse(await readFile(this.hostPath, 'utf8'));
            const id = parsed.ext_agent_host_id;
            if (typeof id === 'string' && id.startsWith('urn:uuid:'))
                return id;
        }
        catch (error) {
            if (error?.code !== 'ENOENT')
                throw error;
        }
        const id = `urn:uuid:${randomUUID()}`;
        await this.ensureDir();
        await writeFileAtomic(this.hostPath, `${JSON.stringify({ ext_agent_host_id: id }, null, 2)}\n`, {
            mode: FILE_MODE,
            dirMode: DIR_MODE,
        });
        return id;
    }
    /** All account records (full records — callers must never log tokens). */
    async accounts() {
        return Object.values((await this.readDocument()).accounts);
    }
    /** One account by its issued client id. */
    async account(clientId) {
        return (await this.readDocument()).accounts[clientId];
    }
    /** The active account, if any registration exists. */
    async active() {
        const doc = await this.readDocument();
        if (doc.activeClientId !== undefined)
            return doc.accounts[doc.activeClientId];
        return Object.values(doc.accounts)[0];
    }
    /** Whether the one-time welcome has already been shown. */
    async welcomed() {
        return (await this.readDocument()).welcomed === true;
    }
    /** Record that the one-time welcome has been shown. */
    async markWelcomed() {
        await this.modify((doc) => { doc.welcomed = true; });
    }
    /**
     * Insert or replace one account's identity + tokens after a validated
     * sign-in, and make it the active account.
     */
    async saveSignIn(record) {
        await this.modify((doc) => {
            doc.accounts[record.client_id] = record;
            doc.activeClientId = record.client_id;
        });
    }
    /**
     * Replace one account's token set after a refresh. The access token,
     * expiry, scopes, and rotated refresh token move together — never
     * one without the others.
     */
    async saveTokens(clientId, tokens) {
        return this.modify((doc) => {
            const account = doc.accounts[clientId];
            if (account === undefined) {
                throw new Error(`dsh-chatgpt-siwc: no registration for client id ${clientId}`);
            }
            applyTokens(account, tokens);
            return account;
        });
    }
    /**
     * Sign one account out locally: tokens are cleared, the registration
     * (client id + identity + host id) is kept so a later sign-in can
     * reauthorize without re-registering.
     */
    async clearTokens(clientId) {
        await this.modify((doc) => {
            const account = doc.accounts[clientId];
            if (account === undefined)
                return;
            delete account.access_token;
            delete account.refresh_token;
            delete account.id_token;
            delete account.expires_in;
            delete account.expires_at;
            account.scopes = [];
            account.saved_at = new Date().toISOString();
        });
    }
    /** Delete one registration entirely (sign-out with purge). */
    async remove(clientId) {
        await this.modify((doc) => {
            delete doc.accounts[clientId];
            if (doc.activeClientId === clientId)
                delete doc.activeClientId;
        });
    }
    /** Choose which registered account new requests use. */
    async setActive(clientId) {
        await this.modify((doc) => {
            if (doc.accounts[clientId] === undefined) {
                throw new Error(`dsh-chatgpt-siwc: no registration for client id ${clientId}`);
            }
            doc.activeClientId = clientId;
        });
    }
    /** Cache one account's model catalog for offline pickers. */
    async saveModels(clientId, models) {
        await this.modify((doc) => {
            const account = doc.accounts[clientId];
            if (account !== undefined)
                account.models = models;
        });
    }
}
/** Apply one token response onto a record, computing the absolute expiry. */
export function applyTokens(account, tokens) {
    account.access_token = tokens.access_token;
    if (tokens.refresh_token !== undefined)
        account.refresh_token = tokens.refresh_token;
    if (tokens.id_token !== undefined)
        account.id_token = tokens.id_token;
    if (tokens.token_type !== undefined)
        account.token_type = tokens.token_type;
    account.expires_in = tokens.expires_in;
    account.expires_at = tokens.expires_in === undefined
        ? undefined
        : Date.now() + tokens.expires_in * 1000;
    const scopes = parseScopes(tokens.scope);
    if (scopes.length > 0)
        account.scopes = scopes;
    account.saved_at = new Date().toISOString();
    if (account.issuer === undefined)
        account.issuer = ISSUER;
}
/** Whether a record currently holds usable credentials. */
export function isSignedIn(account) {
    return account !== undefined
        && typeof account.access_token === 'string' && account.access_token.length > 0
        && typeof account.refresh_token === 'string' && account.refresh_token.length > 0;
}
/** Whether the record's granted scopes include plan usage. */
export function planGranted(account) {
    return account !== undefined && account.scopes.includes('chatgpt.tokens.use.direct');
}
/** A token-free view of one account, safe to print. */
export function publicView(account) {
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
    };
}
//# sourceMappingURL=store.js.map