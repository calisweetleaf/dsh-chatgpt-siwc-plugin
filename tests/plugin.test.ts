/**
 * Registration wiring and the settings-driven lifecycle: apply() registers
 * exactly one route, one directory entry, and one discovery hook under the
 * plugin's settings namespace; a served settings section re-registers the
 * route atomically when the provider is renamed, and refuses writes it
 * cannot act on. No network: the llm and settings services are mocks.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { ChatGptSiwcAdapter } from '../src/adapter.ts'
import { apply, Config, SETTINGS_NS } from '../src/index.ts'
import type { PluginConfig } from '../src/index.ts'

interface SectionHooks {
  validate: (value: unknown) => void
  setSource: (source: () => unknown) => void
  onChange: () => void
}

/** The mocked plugin context with its captured hooks and handles. */
function mockContext() {
  const disposers: (() => void)[] = []
  const replaceAdapter = vi.fn()
  const registerAdapter = vi.fn(() => Object.assign(vi.fn(), { replace: replaceAdapter }))
  const replaceDirectory = vi.fn()
  const registerConfigurableProviders = vi.fn(() => Object.assign(vi.fn(), { replace: replaceDirectory }))
  const registerModelDiscovery = vi.fn(() => vi.fn())
  const installSection = vi.fn((
    _owner: Context,
    ns: string,
    _schema: typeof Config,
    entry: unknown,
    hooks: SectionHooks,
  ) => {
    captured.ns = ns
    captured.entry = entry
    captured.hooks = hooks
  })
  const injected: Record<string, (context: unknown) => void> = {}
  const captured: { ns?: string; entry?: unknown; hooks?: SectionHooks } = {}
  const ctx = {
    llm: { registerAdapter, registerConfigurableProviders, registerModelDiscovery },
    logger: { error: vi.fn(), warn: vi.fn() },
    settings: { installSection },
    effect: (execute: () => () => void) => {
      disposers.push(execute())
    },
    inject: (names: readonly string[], callback: (context: unknown) => void) => {
      for (const name of names) injected[name] = callback
    },
  }
  return { ctx, disposers, captured, replaceAdapter, replaceDirectory, registerAdapter, registerConfigurableProviders, registerModelDiscovery, installSection, injected }
}

function storeConfig(): PluginConfig {
  return { storePath: join(mkdtempSync(join(tmpdir(), 'dsh-siwc-test-')), 'accounts.json') }
}

describe('apply', () => {
  it('registers the chatgpt route, directory entry, discovery hook, and a settings section', () => {
    const mock = mockContext()
    apply(mock.ctx as never, storeConfig())

    expect(mock.registerAdapter).toHaveBeenCalledTimes(1)
    expect(mock.registerAdapter.mock.calls[0][0]).toEqual(['chatgpt'])
    expect(mock.registerAdapter.mock.calls[0][1]).toBeInstanceOf(ChatGptSiwcAdapter)

    expect(mock.registerConfigurableProviders).toHaveBeenCalledTimes(1)
    expect(mock.registerConfigurableProviders.mock.calls[0][0]).toEqual([
      expect.objectContaining({ provider: 'chatgpt', settingsNs: SETTINGS_NS, settingsPath: [] }),
    ])

    expect(mock.registerModelDiscovery).toHaveBeenCalledTimes(1)
    expect(mock.registerModelDiscovery.mock.calls[0][0]).toBe(SETTINGS_NS)

    // The settings section is installed for the optional service, with the
    // composition entry already schema-resolved.
    expect(mock.injected['settings']).toBeDefined()
    mock.injected['settings'](mock.ctx)
    expect(mock.installSection).toHaveBeenCalledTimes(1)
    expect(mock.captured.ns).toBe(SETTINGS_NS)
    expect(mock.captured.entry).toMatchObject({ provider: 'chatgpt', agentNameHint: 'DeepSeek Harness' })

    // Two effects hold: the registrations' teardown and the discovery offer.
    expect(mock.disposers).toHaveLength(2)
  })

  it('swaps the route atomically when a settings change renames the provider', () => {
    const mock = mockContext()
    apply(mock.ctx as never, storeConfig())
    mock.injected['settings'](mock.ctx)
    const hooks = mock.captured.hooks!

    hooks.setSource(() => ({ provider: 'renamed', agentNameHint: 'DeepSeek Harness' }))
    hooks.onChange()
    expect(mock.replaceAdapter).toHaveBeenCalledWith(['renamed'])
    expect(mock.replaceDirectory).toHaveBeenCalledWith([
      expect.objectContaining({ provider: 'renamed', settingsNs: SETTINGS_NS }),
    ])

    // A change that does not move the route re-judges nothing.
    hooks.onChange()
    expect(mock.replaceAdapter).toHaveBeenCalledTimes(1)
  })

  it('keeps the previous route serving when a settings change is refused', () => {
    const mock = mockContext()
    apply(mock.ctx as never, storeConfig())
    mock.injected['settings'](mock.ctx)
    const hooks = mock.captured.hooks!
    mock.replaceAdapter.mockImplementationOnce(() => { throw new Error('route collision') })

    hooks.setSource(() => ({ provider: 'colliding', agentNameHint: 'DeepSeek Harness' }))
    expect(() => { hooks.onChange() }).not.toThrow()
    expect(mock.ctx.logger.error).toHaveBeenCalled()
  })

  it('refuses settings writes it cannot act on', () => {
    const mock = mockContext()
    apply(mock.ctx as never, storeConfig())
    mock.injected['settings'](mock.ctx)
    const hooks = mock.captured.hooks!

    expect(() => { hooks.validate({ provider: '  ', agentNameHint: 'x' }) }).toThrow(/must not be empty/u)
    expect(() => { hooks.validate({ provider: 'chatgpt', agentNameHint: 'x', reasoningEffort: 'mega' }) }).toThrow(/unsupported reasoning effort/u)
    expect(() => { hooks.validate({ provider: 'chatgpt', agentNameHint: 'x', reasoningEffort: 'high' }) }).not.toThrow()
  })

  it('serves model discovery from the store, honoring cancellation', async () => {
    const mock = mockContext()
    apply(mock.ctx as never, storeConfig())
    const discover = mock.registerModelDiscovery.mock.calls[0][1] as
      (request: unknown, signal?: AbortSignal) => Promise<unknown[]>

    // Signed out with nothing cached: the empty catalog.
    await expect(discover({})).resolves.toEqual([])

    // Aborted before the call: settles immediately with nothing.
    await expect(discover({}, AbortSignal.abort())).resolves.toEqual([])
  })
})
