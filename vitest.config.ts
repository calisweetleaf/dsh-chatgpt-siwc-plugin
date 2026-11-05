import { defineConfig } from 'vitest/config'
import ts from 'typescript'

export default defineConfig({
  plugins: [{
    name: 'siwc-host-decorators',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/account-controller.ts')) return
      // Match the distributed Host build: Node does not execute decorator syntax.
      return { code: ts.transpileModule(code, { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
        experimentalDecorators: false, sourceMap: true,
      }, fileName: id }).outputText, map: null }
    },
  }],
  test: { include: ['tests/**/*.test.ts'] },
})
