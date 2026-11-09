import { constants as fsConstants, copyFile, rm } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import isPathInside from 'is-path-inside';
import { x } from 'tinyexec';
import type { Wxt } from 'wxt';
import { defineWxtModule } from 'wxt/modules';

export interface CopyFileConfig {
  /**
   * Source path relative to the project root or absolute path.
   */
  from: string;
  /**
   * Destination path relative to the sources zip root or absolute path.
   */
  to: string;
}

export interface TurboModuleOptions {
  /**
   * The package name of the project to generate sources for. This needs to match the package name in the `package.json` of the project.
   */
  packageName: string;
  /**
   * Optional list of files to copy into the sources zip.
   *
   * If a string is provided, it will be copied to the zip sources at the root path.
   *
   * @example
   * [{ from: 'README.md', to: 'README.md' }, 'README.md']
   */
  copyFiles?: (CopyFileConfig | string)[];
  /**
   * Whether to clear the zip sources root directory after the zip file is created.
   *
   * @default true
   */
  cleanup?: boolean;
}

declare module 'wxt' {
  export interface InlineConfig {
    turbo: TurboModuleOptions;
  }
}

const LOGGER_PREFIX = '`[wxt-turbo]`';

export default defineWxtModule<TurboModuleOptions>({
  name: 'wxt-turbo',
  configKey: 'turbo',
  async setup(wxtInstance, options) {
    const packageName = options?.packageName;
    if (!packageName) {
      throw new Error('packageName is required');
    }

    // check whether turborepo is installed
    try {
      if ((await x('turbo', ['--version'])).exitCode !== 0) {
        throw new Error(`${LOGGER_PREFIX} Command failed: \`turbo --version\``);
      }
      wxtInstance.logger.info(LOGGER_PREFIX, 'Turborepo detected.');
    } catch (error) {
      // https://github.com/nodejs/node/issues/46869
      if (
        error instanceof Error &&
        'code' in error &&
        typeof error.code === 'string' &&
        error.code === 'ENOENT'
      ) {
        wxtInstance.logger.warn(LOGGER_PREFIX, 'Turborepo is not installed');
        return;
      }
      throw error;
    }

    wxtInstance.hook('config:resolved', (wxt) => {
      if (wxt.config.zip.sourcesRoot === wxt.config.root) {
        wxt.config.zip.sourcesRoot = join(
          wxt.config.outBaseDir,
          `${basename(wxt.config.outDir)}-sources`,
        );
      }
    });

    wxtInstance.hook('zip:sources:start', async (wxt) => {
      await clearZipSourcesRoot(wxt);

      const { sourcesRoot } = wxt.config.zip;
      const absoluteSourcesRoot = resolve(wxt.config.root, sourcesRoot);
      const proc = x('turbo', ['prune', packageName, '--out-dir', absoluteSourcesRoot]);
      proc.process?.stdout?.on('data', (data: Buffer) => {
        wxt.logger.debug(LOGGER_PREFIX, data.toString().trimEnd());
      });
      const res = await proc;
      if (res.exitCode !== 0) {
        throw new Error(res.stderr);
      }

      if (options.copyFiles) {
        await options.copyFiles.reduce(async (previousCopy, fileInfo) => {
          // Preserve copy order so duplicate destinations fail deterministically.
          await previousCopy;
          const absoluteFromPath = resolve(
            wxt.config.root,
            typeof fileInfo === 'string' ? fileInfo : fileInfo.from,
          );
          const absoluteToPath = resolve(
            absoluteSourcesRoot,
            typeof fileInfo === 'string' ? basename(fileInfo) : fileInfo.to,
          );
          await copyFile(
            absoluteFromPath,
            absoluteToPath,
            // fail if destination file already exists
            fsConstants.COPYFILE_EXCL,
          );
        }, Promise.resolve());
      }
    });

    wxtInstance.hook('zip:done', async (wxt) => {
      if (wxt.config.zip.zipSources && (options.cleanup ?? true)) {
        await clearZipSourcesRoot(wxt);
      }
    });
  },
});

async function clearZipSourcesRoot(wxt: Wxt) {
  const { sourcesRoot } = wxt.config.zip;

  // Safety check: ensure sources root is under .output/
  const absoluteSourcesRoot = resolve(wxt.config.root, sourcesRoot);
  if (!isPathInside(absoluteSourcesRoot, wxt.config.outBaseDir)) {
    throw new Error(
      `${LOGGER_PREFIX} Sources root config must be in .output/ directory. Received: ${absoluteSourcesRoot}`,
    );
  }

  await rm(absoluteSourcesRoot, { recursive: true, force: true });
}
