/**
 * The ChatGPT SIWC card on the Plugins page: a one-liner for the summary
 * view, the staged configuration form (with its own save) for the page view.
 * The page draws the title, icon, and crumb itself; only a save writes, and
 * leaving the page discards every staged edit.
 *
 * @module dsh-chatgpt-siwc/client/card
 */

// Type-only: the Plugins page's `plugins.item` SlotMap declaration.
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useRef } from 'react'
import { MANAGE_USAGE_URL } from '../constants.ts'
import type { SiwcCardActions } from './card-form.ts'
import type { SiwcCardFace, SiwcCardState } from './controller.ts'
import type { SiwcCardLocaleKey } from './locales.ts'

/** Props the renderer binds for this card. */
export type SiwcCardProps =
  PropsRuntime<'plugins.item'>
  & PropsLocale<'dsh-chatgpt-siwc'>
  & InjectFace<SiwcCardFace>

/** The card's copy reader, narrowed to this card's keys. */
type T = (key: SiwcCardLocaleKey) => string

/**
 * Render the card's one-liner or its configuration form, as the Plugins page asks.
 * @param props - the view asked for, locale copy, the form snapshot, and its actions.
 * @returns the one-liner, or the form.
 */
export function SiwcCard(props: SiwcCardProps) {
  const { t } = props
  const state = props.useSiwcCard(snapshot => snapshot)
  const accountState = props.useSiwcAccount(snapshot => snapshot)
  if (props.view === 'summary') return <span>{t('summary')}</span>
  return <><SiwcConfigForm t={t} state={state} face={props} /><SiwcAccountPanel t={t} state={accountState} face={props} /></>
}

function SiwcAccountPanel({ t, state, face }: { t: T; state: import('./account-controller.ts').AccountState; face: SiwcCardProps }) {
  const status = state.status
  const pending = status?.attempt?.phase === 'waiting'
  return <section className="siwc-account" aria-label={t('accountTitle')}>
    <header><div><h3>{t('accountTitle')}</h3><p>{t('accountDescription')}</p></div><span className={status?.signedIn ? 'siwc-account-badge is-connected' : 'siwc-account-badge'}>{status?.signedIn ? t('connected') : t('disconnected')}</span></header>
    {state.loading ? <p role="status">{t('loading')}</p> : null}
    {status?.signedIn ? <div className="siwc-account-identity"><strong>{status.account?.name || status.account?.email || t('connected')}</strong>{status.account?.email && status.account.name ? <span>{status.account.email}</span> : null}<span>{status.account?.planGranted ? t('planReady') : t('planMissing')}</span></div> : null}
    {pending ? <div className="siwc-account-pending"><p>{t('waitingForSignIn')}</p>{status?.attempt?.authorizationUrl ? <a href={status.attempt.authorizationUrl} target="_blank" rel="noreferrer">{t('openSignIn')}</a> : null}<button type="button" onClick={face.cancel} disabled={state.busy}>{t('cancelSignIn')}</button></div> : null}
    {state.message ? <p role="alert" className="siwc-account-error">{state.message}</p> : null}
    {state.confirmSignOut ? <div className="siwc-signout-confirm"><strong>{t('signOutConfirmTitle')}</strong><p>{t('signOutConfirmBody')}</p><button onClick={face.cancelSignOut}>{t('keepConnected')}</button><button onClick={face.signOut} disabled={state.busy}>{t('signOut')}</button></div> : null}
    <footer>{status?.account?.accessTokenExpiresAt ? <span>{t('tokenRefreshes')} <time dateTime={status.account.accessTokenExpiresAt}>{new Date(status.account.accessTokenExpiresAt).toLocaleString()}</time></span> : null}<button type="button" onClick={face.refresh} disabled={state.loading || state.busy}>{t('refresh')}</button>{!pending && (!status?.signedIn || status.account) ? <button type="button" onClick={face.signIn} disabled={state.busy}>{state.busy ? t('working') : status?.signedIn ? t('reauthorize') : t('signIn')}</button> : null}{status?.signedIn && !state.confirmSignOut && !pending ? <button type="button" onClick={face.requestSignOut} disabled={state.busy}>{t('signOut')}</button> : null}</footer>
  </section>
}

/** The staged form: read-only notice, fields, sign-in note, and the save. */
function SiwcConfigForm(props: { t: T; state: SiwcCardState; face: SiwcCardActions }) {
  const { t, state } = props
  const discard = useRef(props.face.discard)
  discard.current = props.face.discard
  useEffect(() => () => { discard.current() }, [])
  if (!state.available) {
    return <p className="siwc-unavailable" role="status">{t('unavailable')}</p>
  }
  const disabled = !state.writable
  const blocked = !state.dirty || state.invalid || state.saving
  return (
    <div className="siwc-form">
      {!state.writable ? <p className="siwc-readonly" role="status">{t('readOnly')}</p> : null}
      <ValueField
        id="dsh-siwc-provider"
        label={t('providerLabel')}
        hint={t('providerHint')}
        state={state.provider}
        disabled={disabled}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidText')}
        onEdit={text => { props.face.edit('provider', text) }}
        onReset={() => { props.face.resetField('provider') }}
      />
      <ValueField
        id="dsh-siwc-agent-name"
        label={t('agentNameHintLabel')}
        hint={t('agentNameHintHint')}
        state={state.agentNameHint}
        disabled={disabled}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidText')}
        onEdit={text => { props.face.edit('agentNameHint', text) }}
        onReset={() => { props.face.resetField('agentNameHint') }}
      />
      <SelectField
        id="dsh-siwc-effort"
        label={t('effortLabel')}
        hint={t('effortHint')}
        defaultLabel={t('effortDefault')}
        options={['low', 'medium', 'high']}
        state={state.reasoningEffort}
        disabled={disabled}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidText')}
        onEdit={text => { props.face.edit('reasoningEffort', text) }}
        onReset={() => { props.face.resetField('reasoningEffort') }}
      />
      <ValueField
        id="dsh-siwc-api-base"
        label={t('apiBaseUrlLabel')}
        hint={t('apiBaseUrlHint')}
        state={state.apiBaseUrl}
        disabled={disabled}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidText')}
        onEdit={text => { props.face.edit('apiBaseUrl', text) }}
        onReset={() => { props.face.resetField('apiBaseUrl') }}
      />
      <ValueField
        id="dsh-siwc-store-path"
        label={t('storePathLabel')}
        hint={t('storePathHint')}
        state={state.storePath}
        disabled={disabled}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidText')}
        onEdit={text => { props.face.edit('storePath', text) }}
        onReset={() => { props.face.resetField('storePath') }}
      />
      <div className="siwc-signin">
        <h3>{t('signInTitle')}</h3>
        <p>{t('signInBody')}</p>
        <p><a href={MANAGE_USAGE_URL} target="_blank" rel="noreferrer">{t('manageUsage')}</a></p>
      </div>
      <div className="siwc-footer">
        {state.failed ? <p className="siwc-failed" role="status">{t('saveFailed')}</p> : null}
        <button type="button" className="siwc-save" disabled={blocked} onClick={() => { props.face.save() }}>
          {t(state.saving ? 'saving' : 'save')}
        </button>
      </div>
    </div>
  )
}

/** What every field control needs regardless of its input kind. */
interface FieldControlProps {
  /** Stable id associating the label with its control. */
  id: string
  /** Visible label. */
  label: string
  /** Explanation rendered under the control (shown in place of it while invalid). */
  hint: string
  /** The field's staged state. */
  state: SiwcCardState['provider']
  /** Disables every control (read-only document, or an unavailable namespace). */
  disabled: boolean
  /** Copy for the overridden badge. */
  overriddenLabel: string
  /** Copy for the reset control. */
  resetLabel: string
  /** Copy shown in place of the hint while the draft is invalid. */
  invalidLabel: string
  /** Stage draft text. */
  onEdit: (text: string) => void
  /** Stage a clear so the field re-inherits the composition layer. */
  onReset: () => void
}

/** A staged text field: label, override badge with reset, control, and hint. */
function ValueField(props: FieldControlProps) {
  return (
    <div className="siwc-field">
      <div className="siwc-head">
        <label className="siwc-label" htmlFor={props.id}>{props.label}</label>
        {props.state.overridden
          ? (
            <span className="siwc-badges">
              <span className="siwc-badge">{props.overriddenLabel}</span>
              <button type="button" className="siwc-reset" disabled={props.disabled} onClick={props.onReset}>
                {props.resetLabel}
              </button>
            </span>
          )
          : null}
      </div>
      <input
        id={props.id}
        className="siwc-input"
        type="text"
        {...props.state.invalid ? { 'aria-invalid': true } : {}}
        value={props.state.text}
        disabled={props.disabled}
        onChange={event => { props.onEdit(event.target.value) }}
      />
      <p className={props.state.invalid ? 'siwc-invalid' : 'siwc-hint'}>
        {props.state.invalid ? props.invalidLabel : props.hint}
      </p>
    </div>
  )
}

/** A staged select field: the accepted options plus the composition default. */
function SelectField(props: FieldControlProps & {
  /** Copy for the composition-default option. */
  defaultLabel: string
  /** The values this field accepts. */
  options: readonly string[]
}) {
  const text = props.state.text
  return (
    <div className="siwc-field">
      <div className="siwc-head">
        <label className="siwc-label" htmlFor={props.id}>{props.label}</label>
        {props.state.overridden
          ? (
            <span className="siwc-badges">
              <span className="siwc-badge">{props.overriddenLabel}</span>
              <button type="button" className="siwc-reset" disabled={props.disabled} onClick={props.onReset}>
                {props.resetLabel}
              </button>
            </span>
          )
          : null}
      </div>
      <select
        id={props.id}
        className="siwc-select"
        value={text}
        disabled={props.disabled}
        {...props.state.invalid ? { 'aria-invalid': true } : {}}
        onChange={event => { props.onEdit(event.target.value) }}
      >
        <option value="">{props.defaultLabel}</option>
        {props.options.map(option => <option key={option} value={option}>{option}</option>)}
        {text !== '' && !props.options.includes(text)
          ? <option value={text}>{text}</option>
          : null}
      </select>
      <p className={props.state.invalid ? 'siwc-invalid' : 'siwc-hint'}>
        {props.state.invalid ? props.invalidLabel : props.hint}
      </p>
    </div>
  )
}
