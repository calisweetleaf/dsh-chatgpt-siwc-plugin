/**
 * The plan-usage wire contract, as enforced by serializeRequest: forbidden
 * fields absent by construction, system → instructions, function tools only,
 * the effort vocabulary, and replay shapes.
 */
import { describe, expect, it } from 'vitest'
import { MessageId, ReasoningEffortId, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import { serializeRequest } from '../src/serialize.ts'

function userMessage(text: string): Message {
  return {
    id: MessageId('test-user-1'),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }
}

function assistantMessage(content: readonly ContentBlock[]): Message {
  return {
    id: MessageId('test-assistant-1'),
    role: 'assistant',
    content,
    source: { kind: 'model', provider: 'chatgpt', model: 'gpt-test' },
  }
}

const baseOptions: GenerateOptions = {
  provider: 'chatgpt',
  model: 'gpt-test',
  messages: [userMessage('hello')],
}

describe('serializeRequest', () => {
  it('always sends store:false and stream:true, and never the refused fields', () => {
    const body = serializeRequest({ ...baseOptions, temperature: 0.7, maxTokens: 100 })
    expect(body.store).toBe(false)
    expect(body.stream).toBe(true)
    const keys = Object.keys(body)
    for (const refused of ['max_output_tokens', 'temperature', 'top_p', 'prompt_cache_retention', 'truncation', 'metadata', 'user']) {
      expect(keys).not.toContain(refused)
    }
  })

  it('maps a one-shot system prompt to top-level instructions', () => {
    const body = serializeRequest({ ...baseOptions, system: 'be terse' })
    expect(body.instructions).toBe('be terse')
    expect(body.input).toEqual([
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello' }] },
    ])
  })

  it('maps a leading system message to instructions, never to an input item', () => {
    const system: Message = {
      id: MessageId('test-system-1'),
      role: 'system',
      content: [{ type: 'text', text: 'you are a test' }],
      source: { kind: 'plugin', plugin: 'test' },
    }
    const body = serializeRequest({ ...baseOptions, messages: [system, userMessage('hi')] })
    expect(body.instructions).toContain('you are a test')
    expect(body.input.some((item) => item.type === 'message' && (item.role as string) === 'system')).toBe(false)
    expect(body.input).toHaveLength(1)
  })

  it('passes function tools through and pins tool_choice to auto', () => {
    const body = serializeRequest({
      ...baseOptions,
      tools: [{ name: 'ping', description: 'ping it', parameters: { type: 'object', properties: {} } }],
    })
    expect(body.tools).toEqual([
      { type: 'function', name: 'ping', description: 'ping it', parameters: { type: 'object', properties: {} } },
    ])
    expect(body.tool_choice).toBe('auto')
  })

  it('maps the harness effort vocabulary onto the Responses levels', () => {
    expect(serializeRequest({ ...baseOptions, reasoningEffort: ReasoningEffortId('minimal') }).reasoning).toEqual({ effort: 'low' })
    expect(serializeRequest({ ...baseOptions, reasoningEffort: ReasoningEffortId('low') }).reasoning).toEqual({ effort: 'low' })
    expect(serializeRequest({ ...baseOptions, reasoningEffort: ReasoningEffortId('medium') }).reasoning).toEqual({ effort: 'medium' })
    expect(serializeRequest({ ...baseOptions, reasoningEffort: ReasoningEffortId('high') }).reasoning).toEqual({ effort: 'high' })
    expect(serializeRequest({ ...baseOptions, reasoningEffort: ReasoningEffortId('xhigh') }).reasoning).toEqual({ effort: 'xhigh' })
    expect(serializeRequest({ ...baseOptions, reasoningEffort: ReasoningEffortId('max') }).reasoning).toEqual({ effort: 'xhigh' })
  })

  it('materializes the adapter default effort when the request names none', () => {
    expect(serializeRequest(baseOptions, { reasoningEffort: 'high' }).reasoning).toEqual({ effort: 'high' })
    expect(serializeRequest(baseOptions).reasoning).toBeUndefined()
  })

  it('refuses an effort outside the vocabulary', () => {
    expect(() => serializeRequest({ ...baseOptions, reasoningEffort: ReasoningEffortId('ultra') }))
      .toThrow(/unsupported reasoning effort "ultra"/u)
  })

  it('replays assistant text as an output message and tool calls as function calls', () => {
    const assistant = assistantMessage([
      { type: 'text', text: 'calling' },
      { type: 'tool-call', id: ToolCallId('tc-1'), name: 'ping', arguments: '{"a":1}' },
    ])
    const body = serializeRequest({ ...baseOptions, messages: [assistant] })
    expect(body.input).toEqual([
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'calling' }] },
      { type: 'function_call', call_id: 'tc-1', name: 'ping', arguments: '{"a":1}' },
    ])
  })

  it('sends tool results as function outputs', () => {
    const result: Message = {
      id: MessageId('test-user-2'),
      role: 'user',
      content: [{ type: 'tool-result', toolCallId: ToolCallId('tc-1'), content: [{ type: 'text', text: 'pong' }] }],
      source: { kind: 'tool', callId: ToolCallId('tc-1') },
    }
    const body = serializeRequest({ ...baseOptions, messages: [result] })
    expect(body.input).toEqual([
      { type: 'function_call_output', call_id: 'tc-1', output: 'pong' },
    ])
  })

  it('refuses image input locally rather than silently dropping it', () => {
    const withImage: Message = {
      id: MessageId('test-user-3'),
      role: 'user',
      content: [{ type: 'image', attachment: undefined as never }, { type: 'text', text: 'look' }],
      source: { kind: 'user' },
    }
    expect(() => serializeRequest({ ...baseOptions, messages: [withImage] }))
      .toThrow(/does not accept image input/u)
  })
})
