/** Package-owned typed Remote contract for the token-free account panel. */
import { z } from 'zod'
import type { RemoteResult, TypertRemoteContribution, TypertRemoteNamespace, TypertRemoteNamespaceMap } from '@deepseek-ai/dsh-typert-protocol'
import type { SiwcAccountStatus, SiwcSignInStart, SiwcSignOutResult } from '../account-types.ts'

const identity = () => z.object({ email: z.string().optional(), name: z.string().optional(), clientId: z.string(), scopes: z.array(z.string()), planGranted: z.boolean(), accessTokenExpiresAt: z.string().optional() }).strict()
const attempt = () => z.object({ id: z.string(), phase: z.enum(['waiting', 'succeeded', 'failed', 'cancelled']), authorizationUrl: z.string().optional(), error: z.string().optional() }).strict()
const status = () => z.object({ signedIn: z.boolean(), account: identity().optional(), attempt: attempt().optional() }).strict()
const start = () => z.object({ id: z.string(), authorizationUrl: z.string().url() }).strict()
const signout = () => z.object({ revoked: z.boolean(), email: z.string().optional() }).strict()
const descriptor = (method: string, parameters: TypertRemoteContribution['descriptors'][number]['parameters'], result: () => z.ZodType) => ({
  id: `dsh-chatgpt-siwc#siwcAccount/${method}`, service: 'siwcAccount', namespace: 'siwcAccount', method,
  invocation: { kind: 'direct' as const }, parameters,
  result: { mode: 'strict' as const, typeSymbol: `dsh-chatgpt-siwc#siwcAccount/${method}:result`, create: result },
})
const stringParameter = (name: string, acceptsUndefined = false) => ({ name, wire: name, source: 'json' as const, ...(acceptsUndefined ? { acceptsUndefined: true as const } : {}), codec: { mode: 'strict' as const, typeSymbol: 'string', create: () => z.string() } })
export interface SiwcAccountRemote {
  getStatus(): Promise<RemoteResult<SiwcAccountStatus>>
  startSignIn(clientId?: string): Promise<RemoteResult<SiwcSignInStart>>
  cancelSignIn(attemptId: string): Promise<RemoteResult<SiwcAccountStatus>>
  signOut(): Promise<RemoteResult<SiwcSignOutResult>>
}
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'siwcAccount/getStatus': SiwcAccountRemote['getStatus']
    'siwcAccount/startSignIn': SiwcAccountRemote['startSignIn']
    'siwcAccount/cancelSignIn': SiwcAccountRemote['cancelSignIn']
    'siwcAccount/signOut': SiwcAccountRemote['signOut']
  }
  interface TypertRemoteNamespaceMap { siwcAccount: TypertRemoteNamespace<'siwcAccount'> }
}
export const SIWC_ACCOUNT_REMOTE: TypertRemoteContribution = {
  package: 'dsh-chatgpt-siwc', descriptors: [
    descriptor('getStatus', [], status),
    descriptor('startSignIn', [stringParameter('clientId', true)], start),
    descriptor('cancelSignIn', [stringParameter('attemptId')], status),
    descriptor('signOut', [], signout),
  ],
}
export type SiwcAccountNamespace = TypertRemoteNamespaceMap['siwcAccount']
