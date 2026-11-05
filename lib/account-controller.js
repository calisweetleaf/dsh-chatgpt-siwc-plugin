var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
/** Host Remote for the plugin's file-backed SIWC account lifecycle. */
import { randomUUID } from 'node:crypto';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { login, logout } from "./oauth.js";
import { SiwcError } from "./errors.js";
import { isSignedIn, planGranted } from "./store.js";
let SiwcAccountController = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _getStatus_decorators;
    let _startSignIn_decorators;
    let _cancelSignIn_decorators;
    let _signOut_decorators;
    return class SiwcAccountController extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _getStatus_decorators = [Remote];
            _startSignIn_decorators = [Remote];
            _cancelSignIn_decorators = [Remote];
            _signOut_decorators = [Remote];
            __esDecorate(this, null, _getStatus_decorators, { kind: "method", name: "getStatus", static: false, private: false, access: { has: obj => "getStatus" in obj, get: obj => obj.getStatus }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _startSignIn_decorators, { kind: "method", name: "startSignIn", static: false, private: false, access: { has: obj => "startSignIn" in obj, get: obj => obj.startSignIn }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _cancelSignIn_decorators, { kind: "method", name: "cancelSignIn", static: false, private: false, access: { has: obj => "cancelSignIn" in obj, get: obj => obj.cancelSignIn }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _signOut_decorators, { kind: "method", name: "signOut", static: false, private: false, access: { has: obj => "signOut" in obj, get: obj => obj.signOut }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        options = __runInitializers(this, _instanceExtraInitializers);
        attempt;
        signingOut = false;
        auth;
        constructor(ctx, options) {
            super(ctx, 'siwcAccount');
            this.options = options;
            this.auth = options.auth ?? { login, logout: store => logout(store) };
        }
        async getStatus() {
            const account = await this.options.store().active();
            return {
                signedIn: isSignedIn(account),
                ...(account ? { account: {
                        ...(account.email ? { email: account.email } : {}), ...(account.name ? { name: account.name } : {}),
                        clientId: account.client_id, scopes: [...account.scopes], planGranted: planGranted(account),
                        ...(account.expires_at === undefined ? {} : { accessTokenExpiresAt: new Date(account.expires_at).toISOString() }),
                    } } : {}),
                ...(this.attempt ? { attempt: this.publicAttempt(this.attempt) } : {}),
            };
        }
        async startSignIn(clientId) {
            if (this.signingOut)
                throw new SiwcError('ChatGPT sign-out is still in progress', 'SIGN_OUT_IN_PROGRESS');
            if (this.attempt && !this.attempt.finished)
                throw new SiwcError('a ChatGPT sign-in is already in progress', 'LOGIN_IN_PROGRESS');
            const attempt = { id: randomUUID(), phase: 'waiting', finished: false, controller: new AbortController() };
            this.attempt = attempt;
            let resolveUrl, rejectUrl, hasUrl = false;
            const urlReady = new Promise((resolve, reject) => { resolveUrl = resolve; rejectUrl = reject; });
            const reporter = { line: line => {
                    const url = authorizeUrlFromLine(line);
                    if (!url || hasUrl)
                        return;
                    hasUrl = true;
                    attempt.authorizationUrl = url;
                    resolveUrl(url);
                } };
            const running = this.auth.login({ store: this.options.store(), agentNameHint: this.options.agentNameHint(), clientId,
                openBrowser: false, reporter, signal: attempt.controller.signal }).then(() => {
                attempt.phase = 'succeeded';
                attempt.authorizationUrl = undefined;
                this.ctx.emit('llm/adapters-updated');
            }, error => {
                attempt.phase = attempt.controller.signal.aborted ? 'cancelled' : 'failed';
                attempt.authorizationUrl = undefined;
                attempt.error = safeError(error);
                if (!hasUrl)
                    rejectUrl(error instanceof Error ? error : new Error('ChatGPT sign-in could not start'));
            }).finally(() => { attempt.finished = true; });
            attempt.running = running;
            try {
                return { id: attempt.id, authorizationUrl: await urlReady };
            }
            catch (error) {
                throw new SiwcError(safeError(error), 'LOGIN_START_FAILED', { cause: error });
            }
        }
        async cancelSignIn(attemptId) {
            const attempt = this.attempt;
            if (attempt?.id === attemptId && !attempt.finished) {
                attempt.controller.abort();
                await attempt.running;
            }
            return this.getStatus();
        }
        async signOut() {
            if (this.signingOut)
                throw new SiwcError('ChatGPT sign-out is already in progress', 'SIGN_OUT_IN_PROGRESS');
            this.signingOut = true;
            try {
                if (this.attempt && !this.attempt.finished) {
                    this.attempt.controller.abort();
                    await this.attempt.running;
                }
                const result = await this.auth.logout(this.options.store());
                this.ctx.emit('llm/adapters-updated');
                return result;
            }
            finally {
                this.signingOut = false;
            }
        }
        async dispose() {
            if (this.attempt && !this.attempt.finished) {
                this.attempt.controller.abort();
                await this.attempt.running;
            }
        }
        publicAttempt(attempt) {
            return { id: attempt.id, phase: attempt.phase, ...(attempt.authorizationUrl ? { authorizationUrl: attempt.authorizationUrl } : {}), ...(attempt.error ? { error: attempt.error } : {}) };
        }
    };
})();
export { SiwcAccountController };
function authorizeUrlFromLine(line) {
    try {
        const url = new URL(line.trim());
        if (url.protocol !== 'https:' || url.searchParams.get('response_type') !== 'code' || url.searchParams.get('code_challenge_method') !== 'S256' || !url.searchParams.get('redirect_uri')?.startsWith('http://127.0.0.1:'))
            return undefined;
        url.searchParams.delete('id_token_hint');
        return url.toString();
    }
    catch {
        return undefined;
    }
}
function safeError(error) {
    if (error instanceof SiwcError) {
        const code = /^[A-Z0-9_]+$/u.test(error.code) ? error.code : 'AUTHORIZATION_FAILED';
        return `${code}: ChatGPT sign-in could not be completed. Try again.`;
    }
    return 'ChatGPT sign-in could not be completed on this host. Try again.';
}
//# sourceMappingURL=account-controller.js.map