import ts from '@stzhu/eslint-config/ts';
import vitest from '@stzhu/eslint-config/vitest';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  globalIgnores(['dist/']),
  ts.configs.recommended,
  vitest.configs.recommended,
);
