/**
 * The ChatGPT SIWC settings card: a staged form over the plugin's settings
 * namespace, bound to the Plugins page's `plugins.item` slot.
 *
 * @module dsh-chatgpt-siwc/client/controller
 */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  SiwcCardForm,
  selectField,
  textField,
  type SiwcCardActions,
  type SiwcCardShell,
  type SiwcFieldState,
} from './card-form.ts'
import type { SiwcAccountController, AccountFace, AccountState } from './account-controller.ts'

/** The settings section this card edits — the server Config keys, one-to-one. */
export interface SiwcCardConfig {
  /** Provider route harness configs select this provider by. */
  provider?: string
  /** App name shown at the first sign-in consent screen. */
  agentNameHint?: string
  /** Reasoning effort materialized when a call names none; empty keeps the model default. */
  reasoningEffort?: string
  /** Public API base the plan token is scoped to. */
  apiBaseUrl?: string
  /** Accounts file override; empty uses the Harness home default. */
  storePath?: string
}

/** Reasoning efforts the card offers; the adapter's model picker offers the same subset. */
export const EFFORT_OPTIONS = ['low', 'medium', 'high'] as const

/** What the card renders: the shared shell plus one state per field. */
export interface SiwcCardState extends SiwcCardShell {
  provider: SiwcFieldState
  agentNameHint: SiwcFieldState
  reasoningEffort: SiwcFieldState
  apiBaseUrl: SiwcFieldState
  storePath: SiwcFieldState
}

/** The registration-side face the card's slot entry injects. */
export interface SiwcCardFace extends SiwcCardActions, AccountFace {
  hooks: {
    /** Card snapshot bound by the renderer as useSiwcCard. */
    siwcCard: SnapshotStore<SiwcCardState>
    siwcAccount: AccountFace['hooks']['siwcAccount']
  }
}

/** Bridges the plugin's settings namespace onto the card's staged form. */
export class SiwcCardController {
  private readonly form: SiwcCardForm<SiwcCardConfig>
  private readonly store: SnapshotStore<SiwcCardState>

  /**
   * @param scope - the bound settings scope for the plugin's namespace.
   */
  constructor(scope: SettingsScope<SiwcCardConfig>, private readonly account?: SiwcAccountController) {
    this.form = new SiwcCardForm<SiwcCardConfig>(scope, [
      textField('provider'),
      textField('agentNameHint'),
      selectField('reasoningEffort', EFFORT_OPTIONS),
      textField('apiBaseUrl'),
      textField('storePath'),
    ])
    this.store = this.form.bind(() => this.projection())
  }

  private projection(): SiwcCardState {
    return {
      ...this.form.shell(),
      provider: this.form.field('provider'),
      agentNameHint: this.form.field('agentNameHint'),
      reasoningEffort: this.form.field('reasoningEffort'),
      apiBaseUrl: this.form.field('apiBaseUrl'),
      storePath: this.form.field('storePath'),
    }
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot and its form actions.
   */
  inject(): SiwcCardFace {
    const account = this.account?.inject()
    const fallback = account ?? emptyAccountFace()
    return { ...fallback, hooks: { siwcCard: this.store, siwcAccount: fallback.hooks.siwcAccount }, ...this.form.actions() }
  }

  /** Drop the form's projection listeners; the scope's own lifecycle is separate. */
  dispose(): void {
    this.form.dispose()
  }
}

function emptyAccountFace(): AccountFace {
  const store = createSnapshotStore<AccountState>({ busy: false, loading: false, confirmSignOut: false })
  return { hooks: { siwcAccount: store }, refresh() {}, signIn() {}, cancel() {}, requestSignOut() {}, cancelSignOut() {}, signOut() {} }
}
