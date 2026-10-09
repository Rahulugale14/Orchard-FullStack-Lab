import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

export default async function prepareTestRun(): Promise<void> {
  for (const directory of ['allure-results', 'playwright-report', 'test-results']) {
    const outputDirectory = resolve(directory);
    rmSync(outputDirectory, { recursive: true, force: true });
    mkdirSync(outputDirectory, { recursive: true });
  }
}
