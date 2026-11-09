import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';

import { strFromU8, unzipSync } from 'fflate';

const execFileAsync = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const wxtCli = join(projectRoot, 'node_modules/wxt/bin/wxt.mjs');
const fixtureRoot = new URL('../fixtures/monorepo/', import.meta.url);

async function createFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'wxt-turbo-integration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(fixtureRoot, root, { recursive: true });
  // Turbo needs a Git repository to respect the fixture's output exclusions.
  await execFileAsync('git', ['init', '--quiet', root]);

  const extension = join(root, 'apps/extension');
  const sourcesRoot = join(extension, '.output/firefox-mv2-sources');
  await mkdir(sourcesRoot, { recursive: true });
  await writeFile(join(sourcesRoot, 'stale.txt'), 'Previous sources output\n');

  // Resolve the built package just as a consumer would, without installing
  // dependencies or accessing the network inside the test.
  await mkdir(join(root, 'node_modules'));
  await Promise.all(
    [
      ['wxt-turbo', projectRoot],
      ['wxt', join(projectRoot, 'node_modules/wxt')],
      ['fixture-shared', join(root, 'packages/shared')],
    ].map(([name, target]) => symlink(target, join(root, 'node_modules', name), 'junction')),
  );

  return { extension, sourcesRoot };
}

for (const cleanup of [undefined, false]) {
  test(
    `WXT builds and zips pruned sources with ${cleanup === false ? 'cleanup disabled' : 'default cleanup'}`,
    { timeout: 60_000 },
    async (t) => {
      const { extension, sourcesRoot } = await createFixture(t);
      await execFileAsync(
        process.execPath,
        [wxtCli, 'zip', '--browser', 'firefox', '--mv2', '--sources'],
        {
          cwd: extension,
          env: {
            ...process.env,
            PATH: `${join(projectRoot, 'node_modules/.bin')}${delimiter}${process.env.PATH ?? ''}`,
            TURBO_TELEMETRY_DISABLED: '1',
            WXT_TURBO_TEST_KEEP_SOURCES: cleanup === false ? '1' : '0',
          },
          timeout: 45_000,
        },
      );

      const readZip = async (name) => unzipSync(await readFile(join(extension, '.output', name)));
      const extensionFiles = await readZip('extension.zip');
      const manifest = JSON.parse(strFromU8(extensionFiles['manifest.json']));
      assert.equal(manifest.version, '1.0.0');
      assert.deepEqual(manifest.background.scripts, ['background.js']);
      assert.match(strFromU8(extensionFiles['background.js']), /shared workspace marker/);

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
      assert.equal(strFromU8(sourceFiles['REVIEW.md']), 'Source review instructions\n');
      assert.equal(strFromU8(sourceFiles['BUILD_INSTRUCTIONS.md']), 'Build instructions\n');
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
