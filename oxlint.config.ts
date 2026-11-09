import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['import', 'typescript', 'unicorn', 'vitest'],
  categories: {
    correctness: 'error',
    suspicious: 'warn',
    perf: 'warn',
  },
  options: {
    typeAware: true,
  },
  env: {
    node: true,
  },
  ignorePatterns: ['coverage/'],
});
