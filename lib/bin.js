#!/usr/bin/env node
/**
 * Thin CLI over the plugin's programmatic surface — the operator's way
 * to drive sign-in without the harness running:
 *
 *   dsh-chatgpt-siwc login [--name "DeepSeek Harness"]
 *   dsh-chatgpt-siwc status
 *   dsh-chatgpt-siwc models
 *   dsh-chatgpt-siwc logout [--purge]
 *
 * `status` prints the token-free public view of the active account;
 * tokens are never printed by any command.
 *
 * @module dsh-chatgpt-siwc/bin
 */
import { DEFAULT_AGENT_NAME_HINT } from "./constants.js";
import { SiwcError } from "./errors.js";
import { ensureAccessToken, fetchModels, login, logout, openUrlInBrowser } from "./oauth.js";
import { AccountsStore, isSignedIn, planGranted, publicView } from "./store.js";
const reporter = {
    line: (text) => console.log(text),
    openUrl: (url) => openUrlInBrowser(url, reporter),
};
function flagValue(args, flag) {
    const at = args.indexOf(flag);
    return at >= 0 ? args[at + 1] : undefined;
}
async function main(argv) {
    const [command, ...rest] = argv;
    const store = new AccountsStore(flagValue(rest, '--store'));
    switch (command) {
        case 'login': {
            const result = await login({
                store,
                agentNameHint: flagValue(rest, '--name') ?? DEFAULT_AGENT_NAME_HINT,
                clientId: flagValue(rest, '--client-id'),
                openBrowser: !rest.includes('--no-browser'),
                reporter,
            });
            console.log(JSON.stringify(publicView(result.account), null, 2));
            console.log(result.planGranted
                ? 'plan usage: granted — this account can serve model calls.'
                : 'plan usage: NOT granted — identity only. Check plan access for this app in ChatGPT settings.');
            if (result.firstRegistration) {
                console.log('first sign-in: this installation is now registered with ChatGPT.');
            }
            break;
        }
        case 'status': {
            const active = await store.active();
            if (!isSignedIn(active)) {
                console.log('not signed in. Run: dsh-chatgpt-siwc login');
                break;
            }
            console.log(JSON.stringify(publicView(active), null, 2));
            console.log(`plan usage: ${planGranted(active) ? 'granted' : 'not granted'}`);
            break;
        }
        case 'models': {
            const { account, accessToken } = await ensureAccessToken(store);
            const models = await fetchModels(accessToken);
            await store.saveModels(account.client_id, models).catch(() => undefined);
            for (const model of models)
                console.log(`${model.slug}\t${model.displayName}`);
            break;
        }
        case 'logout': {
            const result = await logout(store, { purge: rest.includes('--purge') });
            console.log(result.revoked
                ? `signed out${result.email ? ` (${result.email})` : ''}; the session was revoked at OpenAI.`
                : 'signed out locally; the revocation at OpenAI could not be confirmed — you can disconnect the app in ChatGPT settings.');
            break;
        }
        default: {
            console.error('usage: dsh-chatgpt-siwc <login|status|models|logout> [options]');
            console.error('  login   [--name <agent name>] [--client-id <oaiapp_…>] [--no-browser] [--store <path>]');
            console.error('  status  [--store <path>]');
            console.error('  models  [--store <path>]');
            console.error('  logout  [--purge] [--store <path>]');
            process.exitCode = 1;
        }
    }
}
main(process.argv.slice(2)).catch((err) => {
    if (err instanceof SiwcError) {
        console.error(`${err.code}: ${err.message}`);
    }
    else {
        console.error(err instanceof Error ? err.message : String(err));
    }
    process.exitCode = 1;
});
//# sourceMappingURL=bin.js.map