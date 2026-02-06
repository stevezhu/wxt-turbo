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
    copyFiles: [{ from: 'FIREFOX_README.md', to: 'README.md' }, 'LICENSE'],
    cleanup: true, // default: true
  },
});
```

## Features

- **Turborepo Pruning**: Automatically prunes your monorepo when running `wxt zip` to include only the necessary sources for the extension.
- **Extra Files**: Copy extra files (like READMEs or legal docs) into the sources zip during the build process.

## License

MIT
