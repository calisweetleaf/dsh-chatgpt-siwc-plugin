import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SiwcAccountController } from '../src/account-controller.ts'
import type { LoginOptions, LoginResult } from '../src/oauth.ts'
import { signedInStore } from './store-fixture.ts'

const handoff = 'https://auth.openai.com/authorize?response_type=code&code_challenge_method=S256&redirect_uri=http%3A%2F%2F127.0.0.1%3A1455%2Fauth%2Fcallback&id_token_hint=secret-hint'
function pendingLogin(options: LoginOptions): Promise<LoginResult> {
  options.reporter?.line(handoff)
  return new Promise((_, reject) => {
    const abort = () => reject(new Error('cancelled'))
    if (options.signal?.aborted) abort()
    else options.signal?.addEventListener('abort', abort, { once: true })
  })
}

describe('account lifecycle Remote', () => {
  it('redacts credentials and handoff hints, then settles a cancelled attempt', async () => {
    const store = await signedInStore()
    const controller = new SiwcAccountController(new Context(), { store: () => store, agentNameHint: () => 'Test', auth: { login: pendingLogin, logout: async () => ({ revoked: false }) } })
    try {
      const start = await controller.startSignIn()
      expect(start.authorizationUrl).not.toContain('secret-hint')
      expect(start.authorizationUrl).not.toContain('id_token_hint')
      const status = await controller.getStatus()
      expect(status.signedIn).toBe(true)
      const wire = JSON.stringify(status)
      expect(wire).not.toContain('at-1')
      expect(wire).not.toContain('rt-1')
      expect(wire).not.toContain('idt-1')
      expect((await controller.cancelSignIn(start.id)).attempt?.phase).toBe('cancelled')
    } finally { await controller.dispose() }
  })

  it('excludes concurrent sign-in and sign-out while logout mutates the account', async () => {
    const store = await signedInStore()
    let finish!: () => void
    const controller = new SiwcAccountController(new Context(), { store: () => store, agentNameHint: () => 'Test', auth: {
      login: pendingLogin,
      logout: async () => { await new Promise<void>(resolve => { finish = resolve }); return { revoked: false } },
    } })
    const pending = controller.signOut()
    await expect(controller.startSignIn()).rejects.toMatchObject({ code: 'SIGN_OUT_IN_PROGRESS' })
    await expect(controller.signOut()).rejects.toMatchObject({ code: 'SIGN_OUT_IN_PROGRESS' })
    finish()
    await pending
    expect((await controller.startSignIn()).authorizationUrl).toContain('auth.openai.com')
    await controller.dispose()
  })
})
