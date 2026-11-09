import process from 'node:process';

import { defineConfig } from 'wxt';

export default defineConfig({
  // Resolve from this fixture because its dependencies link to another checkout.
  modules: [import.meta.resolve('wxt-turbo')],
  manifest: {
    browser_specific_settings: {
      gecko: {
        id: 'integration-test@example.com',
        data_collection_permissions: { required: ['none'] },
      },
    },
  },
  zip: { artifactTemplate: 'extension.zip', sourcesTemplate: 'sources.zip' },
  turbo: {
    packageName: 'fixture-extension',
    copyFiles: ['REVIEW.md', { from: 'BUILD.md', to: 'BUILD_INSTRUCTIONS.md' }],
    cleanup: process.env.WXT_TURBO_TEST_KEEP_SOURCES === '1' ? false : undefined,
  },
});
