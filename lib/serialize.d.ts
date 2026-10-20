/**
 * Serialize harness requests into the public Responses API shape this
 * flow requires — with the plan-usage contract enforced by omission:
 *
 * - `store: false` and `stream: true` on every request.
 * - System prompts travel as the top-level `instructions` field;
 *   `role: "system"` input items are refused on this route (a system
 *   message becomes instructions, never an item).
 * - Fields the API refuses for a ChatGPT plan token are never sent:
 *   `max_output_tokens`, `temperature`, `top_p`,
 *   `prompt_cache_retention`, `truncation`, `metadata`, `user`.
 * - No hosted tools (image generation, code interpreter, file search,
 *   computer use, hosted MCP). Function tools only.
 * - Image/audio input is refused locally with `UNSUPPORTED_CONTENT`
 *   rather than silently dropped.
 *
 * Reasoning blocks are not replayed: with `store: false` there is no
 * server-side state, and this plugin keeps no provider-native replay
 * envelope — assistant text and tool calls replay as plain items.
 *
 * @module dsh-chatgpt-siwc/serialize
 */
import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
/** One Responses input item (message, function call, or function output). */
export type ResponsesInputItem = {
    type: 'message';
    role: 'user' | 'developer';
    content: {
        type: 'input_text';
        text: string;
    }[];
} | {
    type: 'message';
    role: 'assistant';
    content: {
        type: 'output_text';
        text: string;
    }[];
} | {
    type: 'function_call';
    call_id: string;
    name: string;
    arguments: string;
} | {
    type: 'function_call_output';
    call_id: string;
    output: string;
};
/** The wire body for `POST /v1/responses` under a plan token. */
export interface ResponsesRequest {
    model: string;
    instructions?: string;
    input: ResponsesInputItem[];
    tools?: {
        type: 'function';
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    }[];
    tool_choice?: 'auto';
    reasoning?: {
        effort: string;
    };
    store: false;
    stream: true;
}
/**
 * Build one Responses request from a harness request.
 * @param options - the harness request.
 * @param defaults - adapter defaults (reasoning effort when the request names none).
 * @returns the wire body; forbidden fields are absent by construction.
 */
export declare function serializeRequest(options: GenerateOptions, defaults?: {
    reasoningEffort?: string;
}): ResponsesRequest;
