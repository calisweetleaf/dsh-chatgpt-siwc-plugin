#!/usr/bin/env node
/**
 * Build the browser half into the harness client-module artifact: one CJS
 * bundle wrapped in the `window.__ModuleLoader__.load({ id, factory })`
 * handoff the client module system executes (see the harness cookbook
 * "adding a settings card" — a package outside the harness repository
 * reproduces that artifact format itself). Baseline platform modules (React,
 * cordis, the client store, the shared primitives) stay bare requires the
 * module table answers; everything else inlines. The CSS rides in as text
 * and is injected at materialization, so the one served `client.js` file is
 * the entire artifact.
 */
import { build } from 'esbuild'

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  sourcemap: 'external',
  legalComments: 'none',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  external: [
    'react',
    'react/jsx-runtime',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-primitives',
  ],
  loader: { '.css': 'text' },
  banner: {
    js: 'window.__ModuleLoader__.load({ id: "dsh-chatgpt-siwc", factory: (require) => {\n'
      + 'var module = { exports: {} }; var exports = module.exports;',
  },
  footer: { js: 'return module.exports; } });' },
})
