/** Token-free account status shared with the browser panel. */
export interface SiwcAccountAttempt {
  id: string
  phase: 'waiting' | 'succeeded' | 'failed' | 'cancelled'
  authorizationUrl?: string
  error?: string
}

export interface SiwcAccountStatus {
  signedIn: boolean
  account?: {
    email?: string
    name?: string
    clientId: string
    scopes: string[]
    planGranted: boolean
    accessTokenExpiresAt?: string
  }
  attempt?: SiwcAccountAttempt
}

export interface SiwcSignInStart { id: string; authorizationUrl: string }
export interface SiwcSignOutResult { revoked: boolean; email?: string }

/** Public identity projection, with no credential material. */
export type SiwcAccountIdentity = NonNullable<SiwcAccountStatus['account']>
