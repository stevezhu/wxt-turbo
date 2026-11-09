import { defineConfig } from 'oxfmt';

export default defineConfig({
  singleQuote: true,
  sortImports: true,
  sortPackageJson: {},
  ignorePatterns: ['coverage/'],
});
