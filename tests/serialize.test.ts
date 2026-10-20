/**
 * The plan-usage wire contract, as enforced by serializeRequest:
 * forbidden fields absent by construction, system → instructions,
 * function tools only.
 */
import { describe, expect, it } from 'vitest'
import { MessageId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import { serializeRequest } from '../src/serialize.ts'

function userMessage(text: string): Message {
  return {
    id: MessageId('test-user-1'),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
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
})
