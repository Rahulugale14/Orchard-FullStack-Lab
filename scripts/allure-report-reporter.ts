import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { FullResult, Reporter } from '@playwright/test/reporter';

class AllureReportReporter implements Reporter {
  onEnd(_result: FullResult): void {
    const cliPath = resolve('node_modules', 'allure-commandline', 'bin', 'allure');
    const report = spawnSync(
      process.execPath,
      [cliPath, 'generate', resolve('allure-results'), '--clean', '-o', resolve('allure-report')],
      { stdio: 'inherit' },
    );

    if (report.error) throw report.error;
    if (report.status !== 0) {
      throw new Error(`Allure report generation failed with exit code ${report.status}.`);
    }
  }
}

export default AllureReportReporter;
