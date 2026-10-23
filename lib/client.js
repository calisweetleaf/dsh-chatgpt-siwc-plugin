window.__ModuleLoader__.load({ id: "dsh-chatgpt-siwc", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  NS: () => NS,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/card.tsx
var import_react = require("react");

// src/constants.ts
var ISSUER = "https://auth.openai.com";
var DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;
var IDENTITY_SCOPES = ["openid", "profile", "email"];
var PLAN_SCOPES = ["offline_access", "resource.invoke", "chatgpt.tokens.use.direct"];
var ALL_SCOPES = [...IDENTITY_SCOPES, ...PLAN_SCOPES];
var MANAGE_USAGE_URL = "https://chatgpt.com/settings/usage";
var REFRESH_SKEW_MS = 5 * 60 * 1e3;

// src/client/card.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function SiwcCard(props) {
  const { t } = props;
  const state = props.useSiwcCard((snapshot) => snapshot);
  if (props.view === "summary") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("summary") });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiwcConfigForm, { t, state, face: props });
}
function SiwcConfigForm(props) {
  const { t, state } = props;
  const discard = (0, import_react.useRef)(props.face.discard);
  discard.current = props.face.discard;
  (0, import_react.useEffect)(() => () => {
    discard.current();
  }, []);
  if (!state.available) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "siwc-unavailable", role: "status", children: t("unavailable") });
  }
  const disabled = !state.writable;
  const blocked = !state.dirty || state.invalid || state.saving;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "siwc-form", children: [
    !state.writable ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "siwc-readonly", role: "status", children: t("readOnly") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      ValueField,
      {
        id: "dsh-siwc-provider",
        label: t("providerLabel"),
        hint: t("providerHint"),
        state: state.provider,
        disabled,
        overriddenLabel: t("overridden"),
        resetLabel: t("reset"),
        invalidLabel: t("invalidText"),
        onEdit: (text) => {
          props.face.edit("provider", text);
        },
        onReset: () => {
          props.face.resetField("provider");
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      ValueField,
      {
        id: "dsh-siwc-agent-name",
        label: t("agentNameHintLabel"),
        hint: t("agentNameHintHint"),
        state: state.agentNameHint,
        disabled,
        overriddenLabel: t("overridden"),
        resetLabel: t("reset"),
        invalidLabel: t("invalidText"),
        onEdit: (text) => {
          props.face.edit("agentNameHint", text);
        },
        onReset: () => {
          props.face.resetField("agentNameHint");
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      SelectField,
      {
        id: "dsh-siwc-effort",
        label: t("effortLabel"),
        hint: t("effortHint"),
        defaultLabel: t("effortDefault"),
        options: ["low", "medium", "high"],
        state: state.reasoningEffort,
        disabled,
        overriddenLabel: t("overridden"),
        resetLabel: t("reset"),
        invalidLabel: t("invalidText"),
        onEdit: (text) => {
          props.face.edit("reasoningEffort", text);
        },
        onReset: () => {
          props.face.resetField("reasoningEffort");
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      ValueField,
      {
        id: "dsh-siwc-api-base",
        label: t("apiBaseUrlLabel"),
        hint: t("apiBaseUrlHint"),
        state: state.apiBaseUrl,
        disabled,
        overriddenLabel: t("overridden"),
        resetLabel: t("reset"),
        invalidLabel: t("invalidText"),
        onEdit: (text) => {
          props.face.edit("apiBaseUrl", text);
        },
        onReset: () => {
          props.face.resetField("apiBaseUrl");
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      ValueField,
      {
        id: "dsh-siwc-store-path",
        label: t("storePathLabel"),
        hint: t("storePathHint"),
        state: state.storePath,
        disabled,
        overriddenLabel: t("overridden"),
        resetLabel: t("reset"),
        invalidLabel: t("invalidText"),
        onEdit: (text) => {
          props.face.edit("storePath", text);
        },
        onReset: () => {
          props.face.resetField("storePath");
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "siwc-signin", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: t("signInTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("signInBody") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: MANAGE_USAGE_URL, target: "_blank", rel: "noreferrer", children: t("manageUsage") }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "siwc-footer", children: [
      state.failed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "siwc-failed", role: "status", children: t("saveFailed") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "siwc-save", disabled: blocked, onClick: () => {
        props.face.save();
      }, children: t(state.saving ? "saving" : "save") })
    ] })
  ] });
}
function ValueField(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "siwc-field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "siwc-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "siwc-label", htmlFor: props.id, children: props.label }),
      props.state.overridden ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "siwc-badges", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "siwc-badge", children: props.overriddenLabel }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "siwc-reset", disabled: props.disabled, onClick: props.onReset, children: props.resetLabel })
      ] }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "input",
      {
        id: props.id,
        className: "siwc-input",
        type: "text",
        ...props.state.invalid ? { "aria-invalid": true } : {},
        value: props.state.text,
        disabled: props.disabled,
        onChange: (event) => {
          props.onEdit(event.target.value);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: props.state.invalid ? "siwc-invalid" : "siwc-hint", children: props.state.invalid ? props.invalidLabel : props.hint })
  ] });
}
function SelectField(props) {
  const text = props.state.text;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "siwc-field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "siwc-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "siwc-label", htmlFor: props.id, children: props.label }),
      props.state.overridden ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "siwc-badges", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "siwc-badge", children: props.overriddenLabel }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "siwc-reset", disabled: props.disabled, onClick: props.onReset, children: props.resetLabel })
      ] }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "select",
      {
        id: props.id,
        className: "siwc-select",
        value: text,
        disabled: props.disabled,
        ...props.state.invalid ? { "aria-invalid": true } : {},
        onChange: (event) => {
          props.onEdit(event.target.value);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: props.defaultLabel }),
          props.options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: option, children: option }, option)),
          text !== "" && !props.options.includes(text) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: text, children: text }) : null
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: props.state.invalid ? "siwc-invalid" : "siwc-hint", children: props.state.invalid ? props.invalidLabel : props.hint })
  ] });
}

// src/client/card-form.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
function textField(field) {
  return {
    field,
    format: (value) => typeof value === "string" ? value : "",
    parse: (text) => {
      const trimmed = text.trim();
      return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
    }
  };
}
function selectField(field, options) {
  const accepted = new Set(options);
  return {
    field,
    format: (value) => typeof value === "string" && accepted.has(value) ? value : "",
    parse: (text) => {
      const trimmed = text.trim();
      return trimmed === "" ? { kind: "clear" } : accepted.has(trimmed) ? { kind: "set", value: trimmed } : void 0;
    }
  };
}
var SiwcCardForm = class {
  /**
   * @param scope - the bound settings scope for this card's namespace.
   * @param specs - the section fields this card edits.
   */
  constructor(scope, specs) {
    this.scope = scope;
    this.specs = new Map(specs.map((spec) => [spec.field, spec]));
    scope.subscribe(() => {
      this.publish();
    });
  }
  scope;
  specs;
  staged = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  saving = false;
  failed = false;
  /** Drop the projection listeners; the scope's own lifecycle is separate. */
  dispose() {
    this.listeners.clear();
  }
  /**
   * Publish a projection of this form, rebuilt whenever the scope or a draft changes.
   * @param project - build the card's state from the form's current reads.
   * @returns the store the card's component reads through its bound selector.
   */
  bind(project) {
    const store = (0, import_dsh_client_store.createSnapshotStore)(project());
    this.listeners.add(() => {
      store.set(project());
    });
    return store;
  }
  /**
   * Read the card-level state: what the Host serves, and what a save would do.
   * @returns the form state the whole card shares.
   */
  shell() {
    const plan = this.plan();
    return {
      available: this.snapshotOf().status === "ready",
      writable: this.snapshotOf().writable,
      dirty: plan.length > 0,
      invalid: plan.some((item) => item.run === void 0),
      saving: this.saving,
      failed: this.failed
    };
  }
  /**
   * Read one control's state.
   * @param field - field name inside the namespace section.
   * @returns the draft text, whether a save would leave an override, and whether it is invalid.
   */
  field(field) {
    const staged = this.staged.get(field);
    const spec = this.specOf(field);
    if (staged === void 0) {
      return { text: spec.format(this.sectionValue(field)), overridden: this.stored(field), invalid: false };
    }
    const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
    return {
      text: staged.text,
      overridden: write?.kind === "set",
      invalid: write === void 0
    };
  }
  /**
   * Build the edit, reset, save, and discard actions bound to this form.
   * @returns the actions the card's slot entry injects.
   */
  actions() {
    return {
      edit: (field, text) => {
        this.stage(field, { text, clear: false });
      },
      resetField: (field) => {
        this.stage(field, { text: this.specOf(field).format(this.baseValue(field)), clear: true });
      },
      save: () => {
        void this.save();
      },
      discard: () => {
        if (this.staged.size === 0 && !this.failed) return;
        this.staged.clear();
        this.failed = false;
        this.publish();
      }
    };
  }
  /**
   * Write every staged edit, then re-seed from what the Host accepted. The
   * Host is the only authority on whether a value was accepted, so the
   * outcome is read back from the section rather than predicted here. A
   * save that did not land keeps its drafts, so the user can correct them.
   * @returns settlement after every write and the read-back.
   */
  async save() {
    const plan = this.plan();
    const writes = plan.flatMap((item) => item.run === void 0 ? [] : [item.run]);
    if (plan.length === 0 || this.saving || writes.length !== plan.length) return;
    this.saving = true;
    this.failed = false;
    this.publish();
    let landed = true;
    for (const write of writes) {
      landed = await write() && landed;
    }
    if (landed) this.staged.clear();
    this.saving = false;
    this.failed = !landed;
    this.publish();
  }
  /**
   * Every staged edit a save would write, in staging order. An entry whose
   * draft is not a value its field accepts carries no write: the form is
   * still dirty, and the save refuses rather than dropping the edit.
   * @returns the planned writes.
   */
  plan() {
    const plan = [];
    for (const [field, staged] of this.staged) {
      const spec = this.specOf(field);
      if (staged.clear) {
        if (this.stored(field)) plan.push({ field, run: () => this.clear(field) });
        continue;
      }
      if (staged.text === spec.format(this.sectionValue(field))) continue;
      const write = spec.parse(staged.text);
      if (write === void 0) plan.push({ field, run: void 0 });
      else if (write.kind === "clear") plan.push({ field, run: () => this.clear(field) });
      else plan.push({ field, run: () => this.store(field, write.value) });
    }
    return plan;
  }
  async clear(field) {
    await this.scope.unset(field);
    return !this.stored(field);
  }
  async store(field, value) {
    await this.scope.set(field, value);
    return this.userLayer()?.[field] === value;
  }
  stage(field, edit) {
    this.staged.set(field, edit);
    this.failed = false;
    this.publish();
  }
  specOf(field) {
    const spec = this.specs.get(field);
    if (spec === void 0) throw new Error(`dsh-chatgpt-siwc card has no field ${field}`);
    return spec;
  }
  snapshotOf() {
    return this.scope.getSnapshot();
  }
  sectionValue(field) {
    return this.snapshotOf().value?.[field];
  }
  baseValue(field) {
    return this.snapshotOf().base?.[field];
  }
  userLayer() {
    return this.snapshotOf().user;
  }
  stored(field) {
    const user = this.userLayer();
    return user !== void 0 && Object.hasOwn(user, field);
  }
  publish() {
    for (const listener of this.listeners) listener();
  }
};

// src/client/controller.ts
var EFFORT_OPTIONS = ["low", "medium", "high"];
var SiwcCardController = class {
  form;
  store;
  /**
   * @param scope - the bound settings scope for the plugin's namespace.
   */
  constructor(scope) {
    this.form = new SiwcCardForm(scope, [
      textField("provider"),
      textField("agentNameHint"),
      selectField("reasoningEffort", EFFORT_OPTIONS),
      textField("apiBaseUrl"),
      textField("storePath")
    ]);
    this.store = this.form.bind(() => this.projection());
  }
  projection() {
    return {
      ...this.form.shell(),
      provider: this.form.field("provider"),
      agentNameHint: this.form.field("agentNameHint"),
      reasoningEffort: this.form.field("reasoningEffort"),
      apiBaseUrl: this.form.field("apiBaseUrl"),
      storePath: this.form.field("storePath")
    };
  }
  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot and its form actions.
   */
  inject() {
    return { hooks: { siwcCard: this.store }, ...this.form.actions() };
  }
  /** Drop the form's projection listeners; the scope's own lifecycle is separate. */
  dispose() {
    this.form.dispose();
  }
};

// src/client/locales.ts
var en = {
  title: "ChatGPT \u2014 Sign in with ChatGPT",
  summary: "Serve model calls from your ChatGPT Plus/Pro plan through the official Sign in with ChatGPT flow. Configure the route here; sign in from the terminal.",
  unavailable: "This plugin's configuration is not served by this host.",
  readOnly: "This deployment stores settings read-only; edit the profile configuration instead.",
  save: "Save",
  saving: "Saving\u2026",
  saveFailed: "The save did not land; the drafts were kept.",
  overridden: "overridden",
  reset: "reset",
  invalidText: "This value is not accepted here.",
  providerLabel: "Provider route",
  providerHint: "The route name harness configs select this provider by.",
  agentNameHintLabel: "App name at registration",
  agentNameHintHint: "Shown on the first sign-in consent screen. Use one name consistently across installs.",
  effortLabel: "Default reasoning effort",
  effortHint: "Applied when a call names no effort. Empty keeps the model default.",
  effortDefault: "(model default)",
  apiBaseUrlLabel: "API base URL",
  apiBaseUrlHint: "The public API base the plan token is scoped to.",
  storePathLabel: "Accounts file",
  storePathHint: "Where SIWC accounts are stored; empty uses the Harness home default.",
  signInTitle: "Sign-in",
  signInBody: "Sign-in is an interactive OAuth flow on this machine: run dsh-chatgpt-siwc login in a terminal, approve the plan-usage prompt, and the models appear in the harness picker.",
  manageUsage: "Manage usage (ChatGPT settings)"
};
var zh = {
  title: "ChatGPT \u2014 \u901A\u8FC7 ChatGPT \u767B\u5F55",
  summary: "\u901A\u8FC7\u5B98\u65B9 Sign in with ChatGPT \u6D41\u7A0B\uFF0C\u7528\u4F60\u7684 ChatGPT Plus/Pro \u5957\u9910\u670D\u52A1\u6A21\u578B\u8C03\u7528\u3002\u5728\u6B64\u914D\u7F6E\u8DEF\u7531\uFF0C\u5728\u7EC8\u7AEF\u5B8C\u6210\u767B\u5F55\u3002",
  unavailable: "\u5F53\u524D\u4E3B\u673A\u672A\u63D0\u4F9B\u6B64\u63D2\u4EF6\u7684\u914D\u7F6E\u3002",
  readOnly: "\u6B64\u90E8\u7F72\u7684\u8BBE\u7F6E\u4E3A\u53EA\u8BFB\uFF1B\u8BF7\u6539\u4E3A\u7F16\u8F91 profile \u914D\u7F6E\u3002",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  saveFailed: "\u4FDD\u5B58\u672A\u751F\u6548\uFF1B\u8349\u7A3F\u5DF2\u4FDD\u7559\u3002",
  overridden: "\u5DF2\u8986\u76D6",
  reset: "\u91CD\u7F6E",
  invalidText: "\u8BE5\u503C\u4E0D\u88AB\u63A5\u53D7\u3002",
  providerLabel: "\u63D0\u4F9B\u65B9\u8DEF\u7531",
  providerHint: "harness \u914D\u7F6E\u9009\u62E9\u6B64\u63D0\u4F9B\u65B9\u65F6\u4F7F\u7528\u7684\u8DEF\u7531\u540D\u3002",
  agentNameHintLabel: "\u6CE8\u518C\u65F6\u7684\u5E94\u7528\u540D\u79F0",
  agentNameHintHint: "\u663E\u793A\u5728\u9996\u6B21\u767B\u5F55\u7684\u6388\u6743\u786E\u8BA4\u9875\u3002\u8DE8\u5B89\u88C5\u8BF7\u4FDD\u6301\u540C\u4E00\u540D\u79F0\u3002",
  effortLabel: "\u9ED8\u8BA4\u63A8\u7406\u529B\u5EA6",
  effortHint: "\u8C03\u7528\u672A\u6307\u5B9A\u529B\u5EA6\u65F6\u91C7\u7528\u3002\u7559\u7A7A\u5219\u4F7F\u7528\u6A21\u578B\u9ED8\u8BA4\u3002",
  effortDefault: "\uFF08\u6A21\u578B\u9ED8\u8BA4\uFF09",
  apiBaseUrlLabel: "API \u57FA\u7840 URL",
  apiBaseUrlHint: "\u5957\u9910\u4EE4\u724C\u6240\u7ED1\u5B9A\u5230\u7684\u516C\u5171 API \u57FA\u5740\u3002",
  storePathLabel: "\u8D26\u6237\u6587\u4EF6",
  storePathHint: "SIWC \u8D26\u6237\u7684\u5B58\u50A8\u4F4D\u7F6E\uFF1B\u7559\u7A7A\u4F7F\u7528 Harness \u4E3B\u76EE\u5F55\u9ED8\u8BA4\u503C\u3002",
  signInTitle: "\u767B\u5F55",
  signInBody: "\u767B\u5F55\u662F\u672C\u673A\u4E0A\u7684\u4EA4\u4E92\u5F0F OAuth \u6D41\u7A0B\uFF1A\u5728\u7EC8\u7AEF\u8FD0\u884C dsh-chatgpt-siwc login\uFF0C\u5728\u6388\u6743\u9875\u540C\u610F\u5957\u9910\u4F7F\u7528\uFF0C\u4E4B\u540E\u6A21\u578B\u4F1A\u51FA\u73B0\u5728 harness \u9009\u62E9\u5668\u4E2D\u3002",
  manageUsage: "\u7BA1\u7406\u7528\u91CF\uFF08ChatGPT \u8BBE\u7F6E\uFF09"
};

// src/client/card.css
var card_default = "/*\n * The ChatGPT SIWC card's stylesheet. Imported as text and injected once at\n * bundle materialization (the module system claims the <style> tag); class\n * names carry the `siwc-` prefix, which only this card uses. Colors go\n * through the harness's `--dsw-*` semantic aliases only.\n */\n\n.siwc-form {\n  display: flex;\n  flex-direction: column;\n}\n\n.siwc-unavailable,\n.siwc-readonly {\n  margin: 0 0 12px;\n  font-size: 12px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.siwc-field {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 12px 0;\n}\n\n.siwc-field + .siwc-field {\n  border-top: 0.5px solid var(--dsw-alias-border-l2);\n}\n\n.siwc-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.siwc-label {\n  flex: 1;\n  min-width: 0;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n}\n\n.siwc-badges {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.siwc-badge {\n  font-size: 12px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.siwc-reset {\n  border: none;\n  background: none;\n  padding: 0;\n  font: inherit;\n  font-size: 12px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n}\n\n.siwc-reset:hover:not(:disabled) {\n  color: var(--dsw-alias-label-primary);\n}\n\n.siwc-reset:disabled {\n  cursor: default;\n}\n\n.siwc-input,\n.siwc-select {\n  height: 34px;\n  padding: 0 12px;\n  border: 0.5px solid var(--dsw-alias-border-l4);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-layer-3);\n  font: inherit;\n  font-size: 13px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n}\n\n.siwc-select {\n  appearance: none;\n}\n\n.siwc-input:focus-visible,\n.siwc-select:focus-visible {\n  outline: none;\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.siwc-input:disabled,\n.siwc-select:disabled {\n  color: var(--dsw-alias-label-tertiary);\n  cursor: default;\n}\n\n.siwc-input[aria-invalid='true'],\n.siwc-select[aria-invalid='true'] {\n  border-color: var(--dsw-alias-state-error-primary);\n}\n\n.siwc-invalid {\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.5;\n  color: var(--dsw-alias-state-error-primary);\n}\n\n.siwc-hint {\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.siwc-signin {\n  margin: 4px 0 0;\n  padding: 12px;\n  border: 0.5px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n}\n\n.siwc-signin h3 {\n  margin: 0 0 4px;\n  font-size: 13px;\n  font-weight: 600;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n}\n\n.siwc-signin p {\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.siwc-signin p + p {\n  margin-top: 6px;\n}\n\n.siwc-signin a {\n  color: var(--dsw-alias-brand-primary);\n}\n\n.siwc-signin code {\n  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  font-size: 11px;\n}\n\n.siwc-footer {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding-top: 16px;\n}\n\n.siwc-failed {\n  flex: 1;\n  min-width: 0;\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-error);\n}\n\n.siwc-save {\n  appearance: none;\n  border: 1px solid transparent;\n  border-radius: 8px;\n  padding: 5px 14px;\n  font: inherit;\n  font-size: 13px;\n  line-height: 1.5;\n  cursor: pointer;\n  background: var(--dsw-alias-label-primary);\n  color: var(--dsw-alias-bg-layer-3);\n}\n\n.siwc-save:disabled {\n  opacity: 0.4;\n  cursor: default;\n}\n\n.siwc-save:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: 1px;\n}\n";

// src/client/index.ts
var NS = "dsh-chatgpt-siwc";
var inject = ["slots", "locale", "settingsScope"];
var CARD_ID = "dsh-chatgpt-siwc";
var CARD_ORDER = 50;
var stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  const el = document.createElement("style");
  el.textContent = card_default;
  document.head.append(el);
  stylesInjected = true;
}
function apply(ctx) {
  ensureStyles();
  ctx.effect(() => ctx.locale.register(NS, { zh, en }));
  const t = ctx.locale.bind(NS);
  const controller = new SiwcCardController(ctx.settingsScope.bind({ namespace: NS }));
  ctx.effect(() => () => {
    controller.dispose();
  });
  const describeFace = ctx.settingsScope.describe();
  ctx.effect(() => {
    let off;
    const sync = () => {
      const served = new Set(describeFace.getSnapshot().view?.namespaces.map((view) => view.ns) ?? []);
      const wanted = served.has(NS);
      if (wanted && off === void 0) {
        off = ctx.slots.inject("plugins.item", () => ctx.slots.register({
          name: "plugins.item",
          id: CARD_ID,
          order: CARD_ORDER,
          label: () => t("title"),
          locale: NS,
          inject: () => controller.inject()
        }, SiwcCard));
      } else if (!wanted && off !== void 0) {
        off();
        off = void 0;
      }
    };
    const unsubscribe = describeFace.subscribe(sync);
    void describeFace.ensure();
    sync();
    return () => {
      unsubscribe();
      off?.();
    };
  });
}
return module.exports; } });
