/**
 * Browser half of the plugin: its card on the harness Plugins page.
 *
 * Served by the harness client module system from the `./client` export
 * declared in package.json (`dsh.client.platform: "web"`). The card registers
 * into the Plugins page's `plugins.item` slot — only while the Host serves
 * this plugin's settings namespace — and edits the namespace through the
 * settings scope, so a deployment that never mounts the server half shows no
 * trace of the card. Sign-in stays in the terminal flow
 * (`dsh-chatgpt-siwc login`): the card configures, it does not authenticate.
 *
 * @module dsh-chatgpt-siwc/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: the ctx.locale Context merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the ctx.slots Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: the Plugins page's SlotMap declaration for `plugins.item`.
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
// Type-only: the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-typert-protocol'
import { SiwcCard } from './card.tsx'
import type { SiwcCardConfig } from './controller.ts'
import { SiwcCardController } from './controller.ts'
import { en, zh, type SiwcCardLocaleKey } from './locales.ts'
import { SIWC_ACCOUNT_REMOTE } from './account-remote.ts'
import { SiwcAccountController } from './account-controller.ts'
import css from './card.css'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This card's copy. */
    'dsh-chatgpt-siwc': SiwcCardLocaleKey
  }
}

/** Dictionary namespace owned by this card (the same string as the server's settings namespace). */
export const NS = 'dsh-chatgpt-siwc'

/** Services the card needs: slot registration, copy, and the settings scope. */
export const inject = ['slots', 'locale', 'settingsScope', 'remote']

/** Id the Plugins page lists the card under. */
const CARD_ID = 'dsh-chatgpt-siwc'

/** After the built-in cards (bash 10, agent-loop 20, subagent 30, web-search 40). */
const CARD_ORDER = 50

let stylesInjected = false

/** Inject the card stylesheet once per materialization; the module system claims the tag. */
function ensureStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.textContent = css
  document.head.append(el)
  stylesInjected = true
}

/**
 * Register the card: its dictionaries, its controller over the plugin's
 * settings namespace, and the `plugins.item` entry — held only while the Host
 * serves the namespace, exactly like the built-in configuration cards.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ensureStyles()
  const account = new SiwcAccountController(ctx)
  ctx.effect(() => async () => { await account.dispose() })
  ctx.effect(() => ctx.locale.register(NS, { zh, en }))
  const t = ctx.locale.bind(NS)
  const controller = new SiwcCardController(ctx.settingsScope.bind<SiwcCardConfig>({ namespace: NS }), account)
  ctx.effect(() => () => { controller.dispose() })

  const describeFace = ctx.settingsScope.describe()
  ctx.effect(() => {
    let off: (() => void) | undefined
    const sync = (): void => {
      const served = new Set(describeFace.getSnapshot().view?.namespaces.map(view => view.ns) ?? [])
      const wanted = served.has(NS)
      if (wanted && off === undefined) {
        off = ctx.slots.inject('plugins.item', () => ctx.slots.register({
          name: 'plugins.item',
          id: CARD_ID,
          order: CARD_ORDER,
          label: () => t('title'),
          locale: NS,
          inject: () => controller.inject(),
        }, SiwcCard))
      } else if (!wanted && off !== undefined) {
        off()
        off = undefined
      }
    }
    const unsubscribe = describeFace.subscribe(sync)
    void describeFace.ensure()
    sync()
    return () => {
      unsubscribe()
      off?.()
    }
  })
}
