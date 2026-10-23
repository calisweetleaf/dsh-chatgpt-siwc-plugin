/**
 * The sign-in pages the loopback flow serves on `127.0.0.1` — the visual
 * surface a user actually sees mid-login. Same identity as the Web UI
 * card: white surface, near-black ink, one accent (green) reserved for
 * "plan active". The callback page is held until the sign-in is validated,
 * so the browser lands on the outcome itself, never on a stale spinner.
 *
 * @module dsh-chatgpt-siwc/pages
 */

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         background: #f7f7f5; color: #0d0d0d; display: grid; place-items: center; min-height: 100vh; }
  .card { background: #fff; border: 1px solid #e5e5e0; border-radius: 16px; padding: 32px;
          max-width: 420px; width: calc(100vw - 32px); text-align: center;
          box-shadow: 0 8px 30px rgba(0,0,0,.06); }
  .mark { width: 44px; height: 44px; border-radius: 12px; background: #0d0d0d; color: #fff;
          display: grid; place-items: center; font-weight: 700; font-size: 20px; margin: 0 auto 16px; }
  h1 { font-size: 19px; margin: 0 0 8px; }
  p { font-size: 14px; line-height: 1.55; color: #444; margin: 6px 0; }
  .ok { color: #0a7d43; font-weight: 600; }
  .err { color: #b3261e; font-weight: 600; }
  .spinner { width: 22px; height: 22px; border-radius: 50%; border: 3px solid #e5e5e0;
             border-top-color: #0d0d0d; margin: 14px auto 4px; animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .fine { font-size: 12px; color: #777; }
`

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — DeepSeek Harness</title><style>${STYLE}</style></head>
<body><main class="card"><div class="mark">C</div>${body}</main></body></html>`
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/gu, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!
  ))
}

/** Shown in the browser tab while the user completes consent on OpenAI's page (the root of the loopback server). */
export function waitingPage(): string {
  return page('Signing in', `
    <h1>Signing in with ChatGPT</h1>
    <div class="spinner" role="status" aria-label="Waiting"></div>
    <p>Complete the sign-in in the OpenAI window, and this tab will update.</p>
    <p class="fine">DeepSeek Harness never sees your ChatGPT password.</p>`)
}

/** Shown on the loopback callback after a validated sign-in. */
export function successPage(email: string | undefined, plan: boolean, firstTime: boolean): string {
  return page('Signed in', `
    <h1 class="ok">You're signed in</h1>
    ${email !== undefined ? `<p>${escapeHtml(email)}</p>` : ''}
    ${plan
      ? '<p><strong>Using ChatGPT plan</strong> — eligible requests in DeepSeek Harness now draw on your ChatGPT plan.</p>'
      : '<p class="err">Identity signed in, but ChatGPT plan usage was not granted. Sign in again and approve plan usage to run models.</p>'}
    ${firstTime && plan
      ? '<p class="fine">You can review usage and set a per-app cap any time in ChatGPT settings under Usage.</p>'
      : ''}
    <p class="fine">You can close this tab and return to DeepSeek Harness.</p>`)
}

/** Shown on the loopback callback when the flow fails or is denied. */
export function errorPage(message: string): string {
  return page('Sign-in failed', `
    <h1 class="err">Sign-in didn't complete</h1>
    <p>${escapeHtml(message)}</p>
    <p class="fine">Return to DeepSeek Harness and run the sign-in again.</p>`)
}
