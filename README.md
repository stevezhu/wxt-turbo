# wxt-turbo

WXT module for Turborepo integration.

## Installation

```bash
npm install -D wxt-turbo
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
      { from: 'FIREFOX_README.md', to: 'FIREFOX_README.md' },
    ],
    cleanup: true,
  },
});
```

## Features

- **Turborepo Pruning**: Automatically prunes your monorepo when running `wxt zip` to include only the necessary sources for the extension.
- **Extra Files**: Copy extra files (like READMEs or legal docs) into the sources zip during the build process.

## License

MIT
