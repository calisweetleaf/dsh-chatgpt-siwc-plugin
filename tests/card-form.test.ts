/**
 * The settings card's staged form over a faked settings scope: staging,
 * save-only writes, override detection by user-layer presence, invalid
 * drafts blocking the save, and read-back seeding after the Host accepts.
 */
import { describe, expect, it, vi } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { SiwcCardController } from '../src/client/controller.ts'
import type { SiwcCardConfig } from '../src/client/controller.ts'

/** An in-memory scope: writes land in the user layer and publish immediately. */
class FakeScope implements SettingsScope<SiwcCardConfig> {
  private readonly listeners = new Set<() => void>()
  private snapshot: SettingsScopeSnapshot<SiwcCardConfig>
  /** When true, writes never land — the Host refused them. */
  failWrites = false

  constructor(section: SiwcCardConfig, user: SiwcCardConfig) {
    this.snapshot = {
      status: 'ready',
      value: section,
      base: { provider: 'chatgpt', agentNameHint: 'DeepSeek Harness' },
      user,
      revision: 1,
      writable: true,
      mode: 'host',
    }
  }

  getSnapshot(): SettingsScopeSnapshot<SiwcCardConfig> {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async set(field: string, value: unknown): Promise<void> {
    if (this.failWrites) return
    this.snapshot = {
      ...this.snapshot,
      revision: this.snapshot.revision + 1,
      user: { ...(this.snapshot.user as object), [field]: value },
      value: { ...this.snapshot.value, [field]: value } as SiwcCardConfig,
    }
    this.publish()
  }

  async unset(field: string): Promise<void> {
    if (this.failWrites) return
    const user = { ...(this.snapshot.user as Record<string, unknown>) }
    delete user[field]
    this.snapshot = { ...this.snapshot, revision: this.snapshot.revision + 1, user }
    this.publish()
  }

  async mutate(): Promise<void> {
    throw new Error('the card stages field writes, never direct mutations')
  }

  private publish(): void {
    for (const listener of this.listeners) listener()
  }
}

/** The controller over one scope, with its state read through the bound store. */
function cardWith(section: SiwcCardConfig, user: SiwcCardConfig) {
  const scope = new FakeScope(section, user)
  const controller = new SiwcCardController(scope)
  const state = () => controller.inject().hooks.siwcCard.getSnapshot()
  const actions = () => controller.inject()
  return { scope, controller, state, actions }
}

/** Wait for a fired save to settle (the action itself is fire-and-forget). */
async function settleSave(card: ReturnType<typeof cardWith>): Promise<void> {
  await vi.waitFor(() => {
    expect(card.state().saving).toBe(false)
    expect(card.state().dirty).toBe(false)
  })
}

describe('SiwcCardController staged form', () => {
  it('shows effective values and marks overrides by user-layer presence', () => {
    const card = cardWith({ provider: 'chatgpt', agentNameHint: 'DeepSeek Harness' }, { provider: 'chatgpt' })
    const state = card.state()
    expect(state.provider).toEqual({ text: 'chatgpt', overridden: true, invalid: false })
    expect(state.agentNameHint).toEqual({ text: 'DeepSeek Harness', overridden: false, invalid: false })
    expect(state.available).toBe(true)
    expect(state.writable).toBe(true)
    expect(state.dirty).toBe(false)
  })

  it('stages edits and writes them only on save', async () => {
    const card = cardWith({ provider: 'chatgpt', agentNameHint: 'DeepSeek Harness' }, {})
    card.actions().edit('agentNameHint', 'My Harness')
    expect(card.state().dirty).toBe(true)
    expect(card.scope.getSnapshot().revision).toBe(1)
    card.actions().save()
    await settleSave(card)
    expect(card.scope.getSnapshot().value.agentNameHint).toBe('My Harness')
    expect(card.state().agentNameHint).toEqual({ text: 'My Harness', overridden: true, invalid: false })
    expect(card.state().failed).toBe(false)
  })

  it('clears a text field whose draft empties', async () => {
    const card = cardWith({ provider: 'chatgpt', agentNameHint: 'DeepSeek Harness' }, { agentNameHint: 'Mine' })
    card.actions().edit('agentNameHint', '')
    card.actions().save()
    await settleSave(card)
    expect(card.state().agentNameHint.overridden).toBe(false)
    expect('agentNameHint' in (card.scope.getSnapshot().user as object)).toBe(false)
  })

  it('stages a reset back to the composition layer', async () => {
    const card = cardWith({ provider: 'renamed', agentNameHint: 'DeepSeek Harness' }, { provider: 'renamed' })
    card.actions().resetField('provider')
    expect(card.state().dirty).toBe(true)
    card.actions().save()
    await settleSave(card)
    expect(card.state().provider.overridden).toBe(false)
  })

  it('blocks the save while a select draft names an unaccepted value', async () => {
    const card = cardWith({ provider: 'chatgpt', agentNameHint: 'DeepSeek Harness' }, {})
    card.actions().edit('reasoningEffort', 'turbo')
    expect(card.state().invalid).toBe(true)
    expect(card.state().dirty).toBe(true)
    const revision = card.scope.getSnapshot().revision
    card.actions().save()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(card.scope.getSnapshot().revision).toBe(revision)
    expect(card.state().reasoningEffort.text).toBe('turbo')
  })

  it('keeps the drafts when the Host did not accept the write', async () => {
    const card = cardWith({ provider: 'chatgpt', agentNameHint: 'DeepSeek Harness' }, {})
    card.scope.failWrites = true
    card.actions().edit('agentNameHint', 'Refused')
    card.actions().save()
    await vi.waitFor(() => {
      expect(card.state().failed).toBe(true)
    })
    expect(card.state().dirty).toBe(true)
    expect(card.state().agentNameHint.text).toBe('Refused')
  })

  it('discards every staged edit', () => {
    const card = cardWith({ provider: 'chatgpt', agentNameHint: 'DeepSeek Harness' }, {})
    card.actions().edit('provider', 'renamed')
    card.actions().discard()
    expect(card.state().dirty).toBe(false)
    expect(card.state().provider.text).toBe('chatgpt')
  })
})
