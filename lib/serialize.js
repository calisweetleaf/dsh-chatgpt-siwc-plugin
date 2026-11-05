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
import { LlmError } from '@deepseek-ai/dsh-llm';
/** Harness reasoning efforts mapped onto Responses effort levels (`max` has no Responses spelling). The picker offers the subset in adapter EFFORTS; the serializer accepts this whole table. */
export const EFFORT_MAP = {
    minimal: 'low',
    low: 'low',
    medium: 'medium',
    high: 'high',
    xhigh: 'xhigh',
    max: 'xhigh',
};
function flattenText(blocks) {
    return blocks.filter(block => block.type === 'text').map(block => block.text).join('');
}
function assertNoUnsupportedContent(blocks, where) {
    for (const block of blocks) {
        if (block.type === 'image' || block.type === 'file') {
            throw new LlmError(`ChatGPT plan route does not accept ${block.type} input (${where}); the request was not sent.`, 'UNSUPPORTED_CONTENT');
        }
        if (block.type === 'tool-result')
            assertNoUnsupportedContent(block.content, where);
    }
}
/**
 * Build one Responses request from a harness request.
 * @param options - the harness request.
 * @param defaults - adapter defaults (reasoning effort when the request names none).
 * @returns the wire body; forbidden fields are absent by construction.
 */
export function serializeRequest(options, defaults = {}) {
    const instructions = [];
    if (options.system !== undefined && options.system.length > 0)
        instructions.push(options.system);
    const input = [];
    for (const message of options.messages) {
        assertNoUnsupportedContent(message.content, `message ${message.id}`);
        if (message.role === 'system') {
            const text = flattenText(message.content);
            if (text.length > 0)
                instructions.push(text);
            continue;
        }
        if (message.role === 'assistant') {
            let text = '';
            const flushText = () => {
                if (!text)
                    return;
                input.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] });
                text = '';
            };
            for (const block of message.content) {
                if (block.type === 'tool-call') {
                    flushText();
                    input.push({
                        type: 'function_call',
                        call_id: String(block.id),
                        name: block.name,
                        arguments: block.arguments,
                    });
                }
                else if (block.type === 'text') {
                    text += block.text;
                }
            }
            flushText();
            continue;
        }
        // User text and function outputs retain their original order. A tool
        // result's output can legitimately be an empty string.
        let text = '';
        let emitted = false;
        const flushText = () => {
            if (!text)
                return;
            input.push({ type: 'message', role: 'user', content: [{ type: 'input_text', text }] });
            text = '';
            emitted = true;
        };
        for (const block of message.content) {
            if (block.type === 'tool-result') {
                flushText();
                input.push({
                    type: 'function_call_output',
                    call_id: String(block.toolCallId),
                    output: flattenText(block.content),
                });
                emitted = true;
            }
            else if (block.type === 'text') {
                text += block.text;
            }
        }
        flushText();
        if (!emitted)
            input.push({ type: 'message', role: 'user', content: [{ type: 'input_text', text: '' }] });
    }
    const effortRaw = options.reasoningEffort !== undefined
        ? String(options.reasoningEffort)
        : defaults.reasoningEffort;
    const effort = effortRaw === undefined || !Object.hasOwn(EFFORT_MAP, effortRaw)
        ? undefined
        : EFFORT_MAP[effortRaw];
    if (effortRaw !== undefined && effort === undefined) {
        throw new LlmError(`unsupported reasoning effort "${effortRaw}"`, 'UNSUPPORTED_REASONING_EFFORT');
    }
    return {
        model: options.model,
        ...(instructions.length > 0 ? { instructions: instructions.join('\n\n') } : {}),
        input,
        ...(options.tools !== undefined && options.tools.length > 0
            ? {
                tools: options.tools.map(tool => ({
                    type: 'function',
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                })),
                tool_choice: 'auto',
            }
            : {}),
        ...(effort !== undefined ? { reasoning: { effort } } : {}),
        store: false,
        stream: true,
    };
}
//# sourceMappingURL=serialize.js.map