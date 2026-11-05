/**
 * Copy for the ChatGPT SIWC card, in the two locales the harness ships.
 *
 * @module dsh-chatgpt-siwc/client/locales
 */

export const en = {
  title: 'ChatGPT — Sign in with ChatGPT',
  summary: 'Serve model calls from your ChatGPT Plus/Pro plan through the official Sign in with ChatGPT flow. Configure the route here; sign in from the terminal.',
  unavailable: "This plugin's configuration is not served by this host.",
  readOnly: 'This deployment stores settings read-only; edit the profile configuration instead.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The save did not land; the drafts were kept.',
  overridden: 'overridden',
  reset: 'reset',
  invalidText: 'This value is not accepted here.',
  providerLabel: 'Provider route',
  providerHint: 'The route name harness configs select this provider by.',
  agentNameHintLabel: 'App name at registration',
  agentNameHintHint: 'Shown on the first sign-in consent screen. Use one name consistently across installs.',
  effortLabel: 'Default reasoning effort',
  effortHint: 'Applied when a call names no effort. Empty keeps the model default.',
  effortDefault: '(model default)',
  apiBaseUrlLabel: 'API base URL',
  apiBaseUrlHint: 'The public API base the plan token is scoped to.',
  storePathLabel: 'Accounts file',
  storePathHint: 'Where SIWC accounts are stored; empty uses the Harness home default.',
  signInTitle: 'Sign-in',
  signInBody: 'Sign-in is an interactive OAuth flow on this machine: run dsh-chatgpt-siwc login in a terminal, approve the plan-usage prompt, and the models appear in the harness picker.',
  manageUsage: 'Manage usage (ChatGPT settings)',
  accountTitle: 'ChatGPT account', accountDescription: 'Connect your account to use its plan in this host.', connected: 'Connected', disconnected: 'Not connected', loading: 'Checking account…', planReady: 'Plan access ready', planMissing: 'Plan access not available', waitingForSignIn: 'Complete sign-in in the browser window.', openSignIn: 'Open sign-in page', cancelSignIn: 'Cancel sign-in', refresh: 'Refresh status', working: 'Working…', signIn: 'Sign in with ChatGPT', reauthorize: 'Reconnect account', signOut: 'Disconnect', signOutConfirmTitle: 'Disconnect this account?', signOutConfirmBody: 'This revokes the saved ChatGPT session on this Host.', keepConnected: 'Keep connected', tokenRefreshes: 'Current access expires',
} as const

/** Every key this card's dictionary carries. */
export type SiwcCardLocaleKey = keyof typeof en

export const zh: Record<SiwcCardLocaleKey, string> = {
  title: 'ChatGPT — 通过 ChatGPT 登录',
  summary: '通过官方 Sign in with ChatGPT 流程，用你的 ChatGPT Plus/Pro 套餐服务模型调用。在此配置路由，在终端完成登录。',
  unavailable: '当前主机未提供此插件的配置。',
  readOnly: '此部署的设置为只读；请改为编辑 profile 配置。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '保存未生效；草稿已保留。',
  overridden: '已覆盖',
  reset: '重置',
  invalidText: '该值不被接受。',
  providerLabel: '提供方路由',
  providerHint: 'harness 配置选择此提供方时使用的路由名。',
  agentNameHintLabel: '注册时的应用名称',
  agentNameHintHint: '显示在首次登录的授权确认页。跨安装请保持同一名称。',
  effortLabel: '默认推理力度',
  effortHint: '调用未指定力度时采用。留空则使用模型默认。',
  effortDefault: '（模型默认）',
  apiBaseUrlLabel: 'API 基础 URL',
  apiBaseUrlHint: '套餐令牌所绑定到的公共 API 基址。',
  storePathLabel: '账户文件',
  storePathHint: 'SIWC 账户的存储位置；留空使用 Harness 主目录默认值。',
  signInTitle: '登录',
  signInBody: '登录是本机上的交互式 OAuth 流程：在终端运行 dsh-chatgpt-siwc login，在授权页同意套餐使用，之后模型会出现在 harness 选择器中。',
  manageUsage: '管理用量（ChatGPT 设置）',
  accountTitle: 'ChatGPT 账户', accountDescription: '连接账户后即可在此主机使用套餐。', connected: '已连接', disconnected: '未连接', loading: '正在检查账户…', planReady: '套餐访问已就绪', planMissing: '套餐访问不可用', waitingForSignIn: '请在浏览器窗口完成登录。', openSignIn: '打开登录页面', cancelSignIn: '取消登录', refresh: '刷新状态', working: '处理中…', signIn: '使用 ChatGPT 登录', reauthorize: '重新连接账户', signOut: '断开连接', signOutConfirmTitle: '断开此账户？', signOutConfirmBody: '这会撤销此主机上保存的 ChatGPT 会话。', keepConnected: '保持连接', tokenRefreshes: '当前访问令牌到期时间',
}
