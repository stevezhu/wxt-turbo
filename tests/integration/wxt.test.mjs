import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';

import { strFromU8, unzipSync } from 'fflate';

const execFileAsync = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const wxtCli = join(projectRoot, 'node_modules/wxt/bin/wxt.mjs');
const { packageManager } = JSON.parse(
  await readFile(join(projectRoot, 'package.json'), 'utf8'),
);

async function createFixture(t, turboOptions) {
  const root = await mkdtemp(join(tmpdir(), 'wxt-turbo-integration-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const extension = join(root, 'apps/extension');
  const sourcesRoot = join(extension, '.output/firefox-mv2-sources');
  const write = async (path, content) => {
    const absolutePath = join(root, path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  };
  const writeJson = (path, value) => write(path, JSON.stringify(value));

  await writeJson('package.json', {
    name: 'integration-workspace',
    private: true,
    packageManager,
  });
  await write('pnpm-workspace.yaml', 'packages:\n  - apps/*\n  - packages/*\n');
  await write(
    'pnpm-lock.yaml',
    `lockfileVersion: '9.0'
settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false
importers:
  .: {}
  apps/extension:
    dependencies:
      fixture-shared:
        specifier: workspace:*
        version: link:../../packages/shared
  packages/shared: {}
  packages/unrelated: {}
`,
  );
  await write('.gitignore', 'node_modules/\n.output/\n.wxt/\n');
  // Turbo needs a Git repository to respect the output exclusions above.
  await execFileAsync('git', ['init', '--quiet', root]);

  await writeJson('apps/extension/package.json', {
    name: 'fixture-extension',
    version: '1.0.0',
    type: 'module',
    dependencies: { 'fixture-shared': 'workspace:*' },
  });
  await write(
    'apps/extension/wxt.config.mjs',
    `import { defineConfig } from 'wxt';
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
  turbo: ${JSON.stringify({
    packageName: 'fixture-extension',
    copyFiles: ['REVIEW.md', { from: 'BUILD.md', to: 'BUILD_INSTRUCTIONS.md' }],
    ...turboOptions,
  })},
});
`,
  );
  await write(
    'apps/extension/entrypoints/background.js',
    `import { defineBackground } from 'wxt/utils/define-background';
import { message } from 'fixture-shared';
export default defineBackground(() => console.log(message));
`,
  );
  await write('apps/extension/REVIEW.md', 'Source review instructions\n');
  await write('apps/extension/BUILD.md', 'Build instructions\n');
  await writeJson('packages/shared/package.json', {
    name: 'fixture-shared',
    version: '1.0.0',
    type: 'module',
    main: './index.js',
  });
  await write(
    'packages/shared/index.js',
    "export const message = 'shared workspace marker';\n",
  );
  await writeJson('packages/unrelated/package.json', {
    name: 'fixture-unrelated',
    version: '1.0.0',
  });
  await write('packages/unrelated/secret.txt', 'Must not be included\n');
  await mkdir(sourcesRoot, { recursive: true });
  await writeFile(join(sourcesRoot, 'stale.txt'), 'Previous sources output\n');

  // Resolve the built package just as a consumer would, without installing
  // dependencies or accessing the network inside the test.
  await mkdir(join(root, 'node_modules'));
  for (const [name, target] of [
    ['wxt-turbo', projectRoot],
    ['wxt', join(projectRoot, 'node_modules/wxt')],
    ['fixture-shared', join(root, 'packages/shared')],
  ]) {
    await symlink(target, join(root, 'node_modules', name), 'junction');
  }

  return { extension, sourcesRoot };
}

for (const cleanup of [undefined, false]) {
  test(
    `WXT builds and zips pruned sources with ${cleanup === false ? 'cleanup disabled' : 'default cleanup'}`,
    { timeout: 60_000 },
    async (t) => {
      const { extension, sourcesRoot } = await createFixture(
        t,
        cleanup === undefined ? {} : { cleanup },
      );
      await execFileAsync(
        process.execPath,
        [wxtCli, 'zip', '--browser', 'firefox', '--mv2', '--sources'],
        {
          cwd: extension,
          env: {
            ...process.env,
            PATH: `${join(projectRoot, 'node_modules/.bin')}${delimiter}${process.env.PATH ?? ''}`,
            TURBO_TELEMETRY_DISABLED: '1',
          },
          timeout: 45_000,
        },
      );

      const readZip = async (name) =>
        unzipSync(await readFile(join(extension, '.output', name)));
      const extensionFiles = await readZip('extension.zip');
      const manifest = JSON.parse(strFromU8(extensionFiles['manifest.json']));
      assert.equal(manifest.version, '1.0.0');
      assert.deepEqual(manifest.background.scripts, ['background.js']);
      assert.match(
        strFromU8(extensionFiles['background.js']),
        /shared workspace marker/,
      );

      const sourceFiles = await readZip('sources.zip');
      for (const path of [
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'apps/extension/package.json',
        'apps/extension/wxt.config.mjs',
        'apps/extension/entrypoints/background.js',
        'packages/shared/package.json',
        'packages/shared/index.js',
      ]) {
        assert.ok(sourceFiles[path], `${path} must be in the sources ZIP`);
      }
      assert.equal(
        strFromU8(sourceFiles['REVIEW.md']),
        'Source review instructions\n',
      );
      assert.equal(
        strFromU8(sourceFiles['BUILD_INSTRUCTIONS.md']),
        'Build instructions\n',
      );
      for (const path of Object.keys(sourceFiles)) {
        assert.doesNotMatch(path, /(^|\/)(node_modules|\.output|\.wxt)(\/|$)/);
        assert.doesNotMatch(path, /^packages\/unrelated\//);
      }
      assert.equal(sourceFiles['stale.txt'], undefined);

      if (cleanup === false) {
        assert.equal(
          await readFile(join(sourcesRoot, 'REVIEW.md'), 'utf8'),
          'Source review instructions\n',
        );
      } else {
        await assert.rejects(access(sourcesRoot), { code: 'ENOENT' });
      }
    },
  );
}
