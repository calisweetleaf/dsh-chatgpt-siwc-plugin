/**
 * Web client layer: this plugin's card in the harness settings UI.
 *
 * Visual identity matches the loopback sign-in pages (src/pages.ts) —
 * white surface, near-black ink and primary button, one accent (green)
 * reserved for "plan active". The fields mirror the server plugin's
 * Config keys one-to-one; the account card shows sign-in state from the
 * token-free public view the server exposes (never tokens).
 *
 * The settings-plugins runtime package is provided by the harness
 * client via the `dsh.client.inject` declaration in package.json; its
 * contract is declared in host.d.ts.
 *
 * @module dsh-chatgpt-siwc/client
 */

import { registerSettingsPlugin } from '@deepseek-ai/dsh-client-ui-settings-plugins'
import type { SettingsPluginDescriptor } from '@deepseek-ai/dsh-client-ui-settings-plugins'

/** Brand tokens shared with the loopback pages (src/pages.ts). */
export const brand = {
  surface: '#ffffff',
  ink: '#111111',
  accent: '#16a34a',
} as const

/** Mirrors MANAGE_USAGE_URL in src/constants.ts (separate bundles). */
const MANAGE_USAGE_URL = 'https://chatgpt.com/settings/usage'

/** The settings card descriptor registered with the harness UI. */
export const settingsPlugin: SettingsPluginDescriptor = {
  id: 'dsh-chatgpt-siwc',
  title: 'ChatGPT — Sign in with ChatGPT',
  description:
    'Serve model calls from your ChatGPT Plus/Pro plan through the official Sign in with ChatGPT flow and the public Responses API. No Codex backend, no token pooling.',
  brand,
  fields: [
    {
      key: 'provider',
      label: 'Provider route',
      kind: 'text',
      defaultValue: 'chatgpt',
      help: 'The route name harness configs select this provider by.',
    },
    {
      key: 'agentNameHint',
      label: 'App name at registration',
      kind: 'text',
      defaultValue: 'DeepSeek Harness',
      help: 'Shown on the first sign-in consent screen. Use one name consistently across installs.',
    },
    {
      key: 'reasoningEffort',
      label: 'Default reasoning effort',
      kind: 'select',
      options: ['', 'low', 'medium', 'high'],
      help: 'Applied when a call names no effort. Empty keeps the model default.',
    },
    {
      key: 'apiBaseUrl',
      label: 'API base URL',
      kind: 'text',
      defaultValue: 'https://api.openai.com/v1',
      help: 'The public API base the plan token is scoped to.',
    },
  ],
  accountCard: {
    kind: 'account',
    signInCommand: 'dsh-chatgpt-siwc login',
    manageUsageUrl: MANAGE_USAGE_URL,
  },
}

/** The token-free account facts the server exposes for display. */
export interface AccountViewInput {
  signedIn: boolean
  email?: string
  name?: string
  planGranted: boolean
}

/** What the account card renders for one sign-in state. */
export interface AccountStatusView {
  label: string
  badge: 'plan active' | 'identity only' | 'signed out'
  /** Badge color: the accent is reserved for "plan active". */
  badgeColor: string
}

/**
 * Render model for the account card. The green accent appears only when
 * plan usage is actually granted — a signed-in account without the plan
 * grant is shown in ink as "identity only", never dressed up as active.
 */
export function accountStatusView(account: AccountViewInput): AccountStatusView {
  if (!account.signedIn) {
    return { label: 'Not signed in', badge: 'signed out', badgeColor: brand.ink }
  }
  const label = account.email ?? account.name ?? 'Signed in'
  return account.planGranted
    ? { label, badge: 'plan active', badgeColor: brand.accent }
    : { label, badge: 'identity only', badgeColor: brand.ink }
}

registerSettingsPlugin(settingsPlugin)

export default settingsPlugin
