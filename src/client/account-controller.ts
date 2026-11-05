import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { Context } from '@deepseek-ai/cordis'
import type { SiwcAccountStatus } from '../account-types.ts'
import type { SiwcAccountRemote } from './account-remote.ts'
import { SIWC_ACCOUNT_REMOTE } from './account-remote.ts'

export interface AccountState { status?: SiwcAccountStatus; busy: boolean; loading: boolean; message?: string; confirmSignOut: boolean }
export interface AccountFace { hooks: { siwcAccount: SnapshotStore<AccountState> }; refresh(): void; signIn(): void; cancel(): void; requestSignOut(): void; cancelSignOut(): void; signOut(): void }
type Namespace = SiwcAccountRemote

export class SiwcAccountController {
  private readonly store = createSnapshotStore<AccountState>({ busy: false, loading: true, confirmSignOut: false })
  private remote?: Namespace
  private unmount?: () => Promise<void>
  private timer?: ReturnType<typeof setInterval>
  private disposed = false
  private generation = 0
  private refreshing?: Promise<void>
  private ownedAttempt?: string
  constructor(private readonly ctx: Context) {
    void this.mount()
  }
  private async mount(): Promise<void> {
    try {
      const unmount = await this.ctx.remote.$mount(SIWC_ACCOUNT_REMOTE)
      if (this.disposed) { await unmount(); return }
      this.unmount = unmount
      this.remote = this.ctx.remote.siwcAccount as Namespace
      await this.refresh()
      this.timer = setInterval(() => { void this.refresh() }, 2500)
    } catch (error) { this.update({ loading: false, message: messageOf(error) }) }
  }
  private update(patch: Partial<AccountState>): void { if (!this.disposed) this.store.update(state => { Object.assign(state, patch) }) }
  async refresh(): Promise<void> {
    if (this.refreshing || !this.remote || this.disposed) return this.refreshing
    const generation = this.generation
    this.refreshing = (async () => {
      try { const status = unwrap<SiwcAccountStatus>(await this.remote!.getStatus()); if (!this.disposed && generation === this.generation) this.update({ status, loading: false, message: undefined }) }
      catch (error) { if (!this.disposed && generation === this.generation) this.update({ loading: false, message: messageOf(error) }) }
    })().finally(() => { this.refreshing = undefined })
    return this.refreshing
  }
  async signIn(): Promise<void> {
    if (!this.remote || this.disposed) return
    const gen = ++this.generation
    let popup: Window | null = null
    try { popup = window.open('about:blank', '_blank'); if (popup) popup.opener = null } catch { /* show link fallback */ }
    this.update({ busy: true, message: undefined })
    try {
      const started = unwrap<{ id: string; authorizationUrl: string }>(await this.remote.startSignIn(this.store.getSnapshot().status?.account?.clientId))
      if (this.disposed || gen !== this.generation) {
        popup?.close()
        await this.remote.cancelSignIn(started.id)
        return
      }
      this.ownedAttempt = started.id
      this.update({ status: { ...(this.store.getSnapshot().status ?? { signedIn: false }), attempt: { ...started, phase: 'waiting' } }, busy: false })
      if (popup) popup.location.href = started.authorizationUrl
      void this.refresh()
    } catch (error) { popup?.close(); if (!this.disposed && gen === this.generation) this.update({ busy: false, message: messageOf(error) }) }
  }
  async cancel(): Promise<void> {
    const id = this.store.getSnapshot().status?.attempt?.id
    if (!this.remote || !id || this.disposed) return
    const gen = ++this.generation; this.update({ busy: true })
    try { const status = unwrap<SiwcAccountStatus>(await this.remote.cancelSignIn(id)); if (!this.disposed && gen === this.generation) { this.ownedAttempt = undefined; this.update({ status, busy: false }) } }
    catch (error) { if (!this.disposed && gen === this.generation) this.update({ busy: false, message: messageOf(error) }) }
  }
  requestSignOut(): void { this.update({ confirmSignOut: true }) }
  cancelSignOut(): void { this.update({ confirmSignOut: false }) }
  async signOut(): Promise<void> {
    if (!this.remote || this.disposed) return
    const gen = ++this.generation; this.update({ busy: true })
    try { unwrap(await this.remote.signOut()); if (!this.disposed && gen === this.generation) { this.ownedAttempt = undefined; this.update({ status: { signedIn: false }, busy: false, confirmSignOut: false }) } }
    catch (error) { if (!this.disposed && gen === this.generation) this.update({ busy: false, message: messageOf(error) }) }
  }
  inject(): AccountFace { return { hooks: { siwcAccount: this.store }, refresh: () => { void this.refresh() }, signIn: () => { void this.signIn() }, cancel: () => { void this.cancel() }, requestSignOut: () => this.requestSignOut(), cancelSignOut: () => this.cancelSignOut(), signOut: () => { void this.signOut() } } }
  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true; this.generation++; clearInterval(this.timer)
    if (this.ownedAttempt && this.remote) await this.remote.cancelSignIn(this.ownedAttempt).catch(() => undefined)
    this.ownedAttempt = undefined
    await this.unmount?.()
  }
}
function unwrap<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'ok' in value) {
    const result = value as { ok: boolean; value?: T; error?: unknown }
    if (result.ok) return result.value as T
    throw result.error
  }
  return value as T
}
function messageOf(error: unknown): string {
  const raw = error instanceof Error ? error.message : error && typeof error === 'object' && 'message' in error ? String((error as {message: unknown}).message) : ''
  return /LOGIN_IN_PROGRESS/.test(raw) ? 'A sign-in is already in progress.' : raw || 'Account request failed. Try again.'
}
