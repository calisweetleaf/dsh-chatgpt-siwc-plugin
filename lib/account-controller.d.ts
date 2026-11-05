import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { LoginOptions, LoginResult } from './oauth.ts';
import type { SiwcAccountStatus, SiwcSignInStart, SiwcSignOutResult } from './account-types.ts';
import { AccountsStore } from './store.ts';
export interface SiwcAccountControllerOptions {
    store: () => AccountsStore;
    agentNameHint: () => string;
    auth?: {
        login: (options: LoginOptions) => Promise<LoginResult>;
        logout: (store: AccountsStore) => Promise<SiwcSignOutResult>;
    };
}
export declare class SiwcAccountController extends TypertRemoteService {
    private readonly options;
    private attempt;
    private signingOut;
    private readonly auth;
    constructor(ctx: Context, options: SiwcAccountControllerOptions);
    getStatus(): Promise<SiwcAccountStatus>;
    startSignIn(clientId?: string): Promise<SiwcSignInStart>;
    cancelSignIn(attemptId: string): Promise<SiwcAccountStatus>;
    signOut(): Promise<SiwcSignOutResult>;
    dispose(): Promise<void>;
    private publicAttempt;
}
