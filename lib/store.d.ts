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
/** One ChatGPT account's registration + credential record (official record shape). */
export interface AccountRecord {
    email?: string;
    name?: string;
    picture?: string;
    issuer: string;
    /** Validated ID-token subject; the account identity (with client_id). */
    subject: string;
    /** The issued `oaiapp_…` client id from the registration callback. */
    client_id: string;
    ext_agent_host_id: string;
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    /** Access-token lifetime in seconds, as issued. */
    expires_in?: number;
    /** Absolute access-token expiry (epoch ms), computed at save time. */
    expires_at?: number;
    /** Granted scopes from the latest token response. */
    scopes: string[];
    /** UTC timestamp of the latest token response. */
    saved_at: string;
    /** Last model catalog this account returned (slug + display name), for offline pickers. */
    models?: {
        slug: string;
        displayName: string;
    }[];
}
/** The accounts document. */
export interface AccountsDocument {
    version: 1;
    /** Client id of the account new requests use. */
    activeClientId?: string;
    /** Whether the one-time first-sign-in welcome has been shown. */
    welcomed?: boolean;
    accounts: Record<string, AccountRecord>;
}
/** Token fields replaced together on exchange/refresh (rotation is atomic). */
export interface TokenSet {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
}
/** Default location of the accounts document. */
export declare function defaultStorePath(): string;
/** Split a space-separated scope string into a list. */
export declare function parseScopes(scope: string | undefined): string[];
export declare class AccountsStore {
    readonly path: string;
    constructor(path?: string);
    /** The sibling file holding this host's stable id. */
    get hostPath(): string;
    private ensureDir;
    /** Read and validate the document; a missing file is an empty document. */
    readDocument(): Promise<AccountsDocument>;
    private writeDocument;
    /** Run one read-modify-write under the cross-process lock. */
    modify<T>(fn: (doc: AccountsDocument) => Promise<T> | T): Promise<T>;
    /**
     * This host's stable `ext_agent_host_id`, created on first use and the
     * same for every later sign-in from this installation.
     */
    hostId(): Promise<string>;
    /** All account records (full records — callers must never log tokens). */
    accounts(): Promise<AccountRecord[]>;
    /** One account by its issued client id. */
    account(clientId: string): Promise<AccountRecord | undefined>;
    /** The active account, if any registration exists. */
    active(): Promise<AccountRecord | undefined>;
    /** Whether the one-time welcome has already been shown. */
    welcomed(): Promise<boolean>;
    /** Record that the one-time welcome has been shown. */
    markWelcomed(): Promise<void>;
    /**
     * Insert or replace one account's identity + tokens after a validated
     * sign-in, and make it the active account.
     */
    saveSignIn(record: AccountRecord): Promise<void>;
    /**
     * Replace one account's token set after a refresh. The access token,
     * expiry, scopes, and rotated refresh token move together — never
     * one without the others.
     */
    saveTokens(clientId: string, tokens: TokenSet): Promise<AccountRecord>;
    /**
     * Sign one account out locally: tokens are cleared, the registration
     * (client id + identity + host id) is kept so a later sign-in can
     * reauthorize without re-registering.
     */
    clearTokens(clientId: string): Promise<void>;
    /** Delete one registration entirely (sign-out with purge). */
    remove(clientId: string): Promise<void>;
    /** Choose which registered account new requests use. */
    setActive(clientId: string): Promise<void>;
    /** Cache one account's model catalog for offline pickers. */
    saveModels(clientId: string, models: {
        slug: string;
        displayName: string;
    }[]): Promise<void>;
}
/** Apply one token response onto a record, computing the absolute expiry. */
export declare function applyTokens(account: AccountRecord, tokens: TokenSet): void;
/** Whether a record currently holds usable credentials. */
export declare function isSignedIn(account: AccountRecord | undefined): account is AccountRecord;
/** Whether the record's granted scopes include plan usage. */
export declare function planGranted(account: AccountRecord | undefined): boolean;
/** A token-free view of one account, safe to print. */
export declare function publicView(account: AccountRecord): Record<string, unknown>;
