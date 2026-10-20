/**
 * Registration wiring and the adapter's auth boundary — no network:
 * an empty store must fail as AUTH before any request is attempted,
 * and apply() must register exactly one route, one directory entry,
 * and one discovery hook under the plugin's settings namespace.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ChatGptSiwcAdapter } from '../src/adapter.ts'
import { apply, SETTINGS_NS } from '../src/index.ts'
import { AccountsStore } from '../src/store.ts'

function tempStore(): AccountsStore {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-siwc-test-'))
  return new AccountsStore(join(dir, 'accounts.json'))
}

describe('apply', () => {
  it('registers the chatgpt route, directory entry, and discovery hook', async () => {
    const disposers: (() => void)[] = []
    const registerAdapter = vi.fn((_providers: string[], _adapter: unknown) =>
      Object.assign(vi.fn(), { replace: vi.fn() }),
    )
    const registerConfigurableProviders = vi.fn((_entries: readonly unknown[]) =>
      Object.assign(vi.fn(), { replace: vi.fn() }),
    )
    const registerModelDiscovery = vi.fn((_ns: string, _fn: unknown) => vi.fn())
    const ctx = {
      llm: { registerAdapter, registerConfigurableProviders, registerModelDiscovery },
      effect: (execute: () => () => void) => {
        disposers.push(execute())
      },
    }

    apply(ctx as never, { storePath: join(mkdtempSync(join(tmpdir(), 'dsh-siwc-test-')), 'accounts.json') })

    expect(registerAdapter).toHaveBeenCalledTimes(1)
    expect(registerAdapter.mock.calls[0][0]).toEqual(['chatgpt'])
    expect(registerAdapter.mock.calls[0][1]).toBeInstanceOf(ChatGptSiwcAdapter)

    expect(registerConfigurableProviders).toHaveBeenCalledTimes(1)
    expect(registerConfigurableProviders.mock.calls[0][0]).toEqual([
      expect.objectContaining({ provider: 'chatgpt', settingsNs: SETTINGS_NS, settingsPath: [] }),
    ])

    expect(registerModelDiscovery).toHaveBeenCalledTimes(1)
    expect(registerModelDiscovery.mock.calls[0][0]).toBe(SETTINGS_NS)
    const discover = registerModelDiscovery.mock.calls[0][1] as (req: unknown) => Promise<unknown[]>
    await expect(discover({})).resolves.toEqual([])

    expect(disposers).toHaveLength(3)
  })
})

describe('ChatGptSiwcAdapter auth boundary', () => {
  it('fails as AUTH with no stored credentials, before any request', async () => {
    const adapter = new ChatGptSiwcAdapter({ store: tempStore() })
    const chunks: unknown[] = []
    await expect(async () => {
      for await (const chunk of adapter.stream({ provider: 'chatgpt', model: 'gpt-test', messages: [] })) {
        chunks.push(chunk)
      }
    }).rejects.toMatchObject({ code: 'AUTH' })
    expect(chunks).toEqual([])
  })

  it('advertises no models when signed out and nothing is cached', async () => {
    const adapter = new ChatGptSiwcAdapter({ store: tempStore() })
    await expect(adapter.listModels('chatgpt')).resolves.toEqual([])
  })
})
