import { defineConfig } from 'oxfmt';

export default defineConfig({
  singleQuote: true,
  printWidth: 80,
  sortImports: true,
  sortPackageJson: {},
  ignorePatterns: [
    'pnpm-lock.yaml',
    'node_modules/',
    'dist/',
    'coverage/',
    '.pnpm-store/',
  ],
});
