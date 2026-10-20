/**
 * The harness-facing adapter: an `LlmAdapter` that serves model calls
 * from the public Responses API (`POST /v1/responses`) with the signed-in
 * account's SIWC plan token.
 *
 * The adapter never signs anyone in — interactive login belongs to the
 * CLI and the settings surface. It only uses stored credentials:
 * `ensureAccessToken` refreshes a near-expiry token non-interactively,
 * and a missing/revoked credential fails as an `AUTH` LlmError naming
 * the fix. Plan usage is checked from the account's granted scopes
 * before any request is sent; identity alone never enables a call.
 *
 * Stream translation: Responses SSE events become harness StreamChunks —
 * text and reasoning deltas open text/reasoning blocks, function-call
 * argument deltas open tool-call blocks, `response.completed` yields
 * usage (input tokens reported uncached, per the TokenUsage contract)
 * and the finish chunk. Provider failures — including the
 * `subscription_sharing_*` family, before or mid-stream — surface as
 * LlmErrors carrying the plain-language explanation from errors.ts.
 *
 * @module dsh-chatgpt-siwc/adapter
 */
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { AccountsStore } from './store.ts';
export interface SiwcAdapterOptions {
    store: AccountsStore;
    /** Public API base; defaults to the documented production base. */
    apiBaseUrl?: string;
    /** Reasoning effort materialized when a call names none. */
    reasoningEffort?: string;
    /** Test/embedding seam: override fetch. */
    fetchFn?: typeof fetch;
}
/** Display name of the one provider route this adapter serves. */
export declare const PROVIDER_DISPLAY_NAME = "ChatGPT (Sign in with ChatGPT)";
export declare class ChatGptSiwcAdapter extends LlmAdapter {
    private readonly store;
    private readonly apiBaseUrl;
    private readonly reasoningEffort?;
    private readonly fetchFn;
    constructor(options: SiwcAdapterOptions);
    private overrides;
    providerInfo(provider: string): LlmProviderInfo;
    /** The signed-in account's cached catalog (offline-safe). */
    private cachedModels;
    listModels(provider: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo>;
    /** A non-2xx response before the stream opens (admission failure). */
    private admissionError;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
