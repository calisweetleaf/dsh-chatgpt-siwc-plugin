import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiwcAccountController } from '../src/client/account-controller.ts'

const url = 'https://auth.openai.com/authorize?state=test'
const idle = { signedIn: false }
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
afterEach(() => { vi.unstubAllGlobals() })
function fixture(initial: object = idle) {
  const popup = { opener: {}, location: { href: 'about:blank' }, close: vi.fn() }
  vi.stubGlobal('window', { open: vi.fn(() => popup) })
  const off = vi.fn(async () => {})
  const remote = {
    getStatus: vi.fn(async () => ({ ok: true, value: initial })),
    startSignIn: vi.fn(async (_clientId?: string) => ({ ok: true, value: { id: 'owned', authorizationUrl: url } })),
    cancelSignIn: vi.fn(async (_id: string) => ({ ok: true, value: { signedIn: false, attempt: { id: 'owned', phase: 'cancelled' } } })),
    signOut: vi.fn(async () => ({ ok: true, value: { revoked: false } })),
  }
  const controller = new SiwcAccountController({ remote: { $mount: async () => off, siwcAccount: remote } } as never)
  return { controller, remote, popup, off }
}
describe('account panel state', () => {
  it('opens the handoff immediately and keeps its link when status polling fails', async () => {
    const f = fixture()
    await tick()
    f.remote.getStatus.mockRejectedValue(new Error('temporary connection failure'))
    await f.controller.signIn()
    expect(f.popup.location.href).toBe(url)
    expect(f.controller.inject().hooks.siwcAccount.getSnapshot().status?.attempt?.authorizationUrl).toBe(url)
    await f.controller.dispose()
    expect(f.remote.cancelSignIn).toHaveBeenCalledWith('owned')
    expect(f.off).toHaveBeenCalledOnce()
  })
  it('does not automatically cancel an attempt owned by another tab', async () => {
    const f = fixture({ signedIn: false, attempt: { id: 'other', phase: 'waiting', authorizationUrl: url } })
    await tick()
    await f.controller.dispose()
    expect(f.remote.cancelSignIn).not.toHaveBeenCalled()
    expect(f.off).toHaveBeenCalledOnce()
  })
  it('reauthorizes the existing registration instead of creating another app', async () => {
    const f = fixture({ signedIn: true, account: { clientId: 'oaiapp_test', scopes: [], planGranted: false } })
    await tick()
    await f.controller.signIn()
    expect(f.remote.startSignIn).toHaveBeenCalledWith('oaiapp_test')
    await f.controller.dispose()
  })
})
