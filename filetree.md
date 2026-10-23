# File Tree: dsh-chatgpt-siwc-plugin

**Generated:** 2026-10-22
**Root:** repository root (see `AGENTS.md` for task routing and ownership).

```text
.
├── .github
│   └── workflows
│       └── ci.yml
├── .gitignore
├── AGENTS.md
├── CONTEXT.md
├── LICENSE
├── MEMORY.md
├── README.md
├── cordis.patch.yml
├── filetree.md
├── lib
│   ├── adapter.d.ts
│   ├── adapter.js
│   ├── adapter.js.map
│   ├── bin.d.ts
│   ├── bin.js
│   ├── bin.js.map
│   ├── client.js            (browser half: the __ModuleLoader__ client-module artifact)
│   ├── client.js.map
│   ├── constants.d.ts
│   ├── constants.js
│   ├── constants.js.map
│   ├── errors.d.ts
│   ├── errors.js
│   ├── errors.js.map
│   ├── index.d.ts
│   ├── index.js
│   ├── index.js.map
│   ├── jwt.d.ts
│   ├── jwt.js
│   ├── jwt.js.map
│   ├── oauth.d.ts
│   ├── oauth.js
│   ├── oauth.js.map
│   ├── pages.d.ts
│   ├── pages.js
│   ├── pages.js.map
│   ├── serialize.d.ts
│   ├── serialize.js
│   ├── serialize.js.map
│   ├── sse.d.ts
│   ├── sse.js
│   ├── sse.js.map
│   ├── store.d.ts
│   ├── store.js
│   └── store.js.map
├── package-lock.json
├── package.json
├── scripts
│   └── build-client.mjs     (esbuild: src/client → lib/client.js artifact)
├── src
│   ├── adapter.ts
│   ├── bin.ts
│   ├── client
│   │   ├── card.css         (text-imported stylesheet, --dsw-* tokens)
│   │   ├── card-form.ts     (staged form over the settings scope)
│   │   ├── card.tsx         (Plugins-page card component)
│   │   ├── controller.ts    (scope → staged-form controller)
│   │   ├── css.d.ts
│   │   ├── index.ts         (browser half: apply/inject, slot registration)
│   │   └── locales.ts       (en + zh dictionaries)
│   ├── constants.ts
│   ├── errors.ts
│   ├── index.ts             (Cordis entry; settings section; registrations)
│   ├── jwt.ts
│   ├── oauth.ts
│   ├── pages.ts
│   ├── serialize.ts
│   ├── sse.ts
│   └── store.ts
├── tests
│   ├── adapter.test.ts     (SSE translation, auth boundary)
│   ├── card-form.test.ts   (settings card staged form)
│   ├── jwt.test.ts         (ID-token verification)
│   ├── oauth.test.ts       (login/refresh/logout/discovery against fakes)
│   ├── plugin.test.ts       (registration + settings-driven lifecycle)
│   ├── serialize.test.ts    (wire contract, efforts, replay shapes)
│   ├── store-fixture.ts
│   └── support.ts           (RSA/JWT fixtures, JSON responses)
├── tsconfig.build.json
├── tsconfig.client.json
├── tsconfig.json
├── vitest.config.ts
└── visual
    └── icon.svg
```

---

This is a spatial map only. It does not define authority or active work.
