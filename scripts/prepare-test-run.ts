
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

export default async function prepareTestRun(): Promise<void> {
  for (const directory of [
    'allure-results',
    'playwright-report',
    'test-results',
  ]) {
    const outputDirectory = resolve(directory);

    // Preserve the directory itself for Docker bind mounts.
    mkdirSync(outputDirectory, { recursive: true });

    // Clean its contents without deleting the directory.
    for (const entry of readdirSync(outputDirectory)) {
      rmSync(resolve(outputDirectory, entry), {
        recursive: true,
        force: true,
      });
    }
  }
}
