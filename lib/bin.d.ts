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
export {};
