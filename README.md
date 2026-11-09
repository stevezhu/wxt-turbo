# wxt-turbo

WXT module for Turborepo integration.

This module intelligently bundles only the extension workspace and its dependent workspaces when creating source zips, excluding unrelated packages from your monorepo.

## Installation

```shell
pnpm install -D wxt-turbo
```

## Usage

Add the module to your `wxt.config.ts`:

```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['wxt-turbo'],
  turbo: {
    packageName: 'your-extension-package-name',
    copyFiles: [
      { from: 'SOURCE_CODE_REVIEW.md', to: 'SOURCE_CODE_REVIEW.md' },
      'SOURCE_CODE_REVIEW.md',
    ],
    cleanup: true, // default: true
  },
});
```

## Features

- **Turborepo Pruning**: Automatically prunes your monorepo when running `wxt zip` to include only the necessary sources for the extension.
- **Extra Files**: Copy extra files (like READMEs or legal docs) into the sources zip during the build process.

## Publishing

Publishing a GitHub release uses `stevezhu/actions/npm-publish@v3` to run checks, build the package, and stage it on npm with provenance. Configure the repository's `NPM_TOKEN` Actions secret with permission to stage this package. The action uses pnpm 11.3.0 or later, selected by `packageManager` in `package.json`.

Review the package in npm's **Staged Packages** tab and approve it with 2FA to make the version public. You can also review it with `pnpm stage list wxt-turbo` and approve it with `pnpm stage approve <stage-id>`. The stage ID is printed in the action logs. See [npm's staged publishing documentation](https://docs.npmjs.com/staged-publishing/).

## License

MIT
