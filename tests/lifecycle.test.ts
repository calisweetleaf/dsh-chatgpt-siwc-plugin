/** Integration checks against real Cordis and LlmRuntime lifecycles. */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { apply } from '../src/index.ts'

function setup() {
  const ctx = new Context()
  const llm = new LlmRuntime(ctx)
  return { ctx, llm }
}

function storePath(): string {
  return join(mkdtempSync(join(tmpdir(), 'dsh-siwc-life-')), 'accounts.json')
}

describe('Cordis lifecycle', () => {
  it('releases adapter, directory, and discovery registrations when unloaded', async () => {
    const { ctx, llm } = setup()
    const fiber = ctx.plugin(apply, { storePath: storePath() })
    await fiber
    expect(llm.listProviders()).toHaveLength(1)
    expect(llm.listConfigurableProviders().map(({ provider }) => provider)).toContain('chatgpt')

    await fiber.dispose()
    expect(llm.listProviders()).toEqual([])
    expect(llm.listConfigurableProviders()).toEqual([])
  })

  it('removes the adapter when directory registration rejects during load', async () => {
    const { ctx, llm } = setup()
    const blocker = llm.registerConfigurableProviders([{
      provider: 'chatgpt', displayName: 'Collision', settingsNs: 'other', settingsPath: [],
    }])
    const fiber = ctx.plugin(apply, { storePath: storePath() })
    await expect(fiber).rejects.toThrow()
    expect(llm.listProviders()).toEqual([])
    blocker()
  })
})
