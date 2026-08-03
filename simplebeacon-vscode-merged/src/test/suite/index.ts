// simplebeacon-ignore memory-leak — Mocha test runner event handlers, test lifetime
import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60000,
    reporter: 'spec',
    exit: false,
  } as any);

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((resolve, reject) => {
    glob('**/*.test.js', { cwd: testsRoot })
      .then((files) => {
        console.log('[SB Test] Found test files:', files);
        files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          const runner = mocha.run((failures: number) => {
            console.log(`[SB Test] Mocha finished. Failures: ${failures}`);
            if (failures > 0) {
              reject(new Error(`${failures} tests failed.`));
            } else {
              resolve();
            }
          });

          runner.on('start', () => {
            console.log(
              `[SB Test] Mocha started. Suite count: ${runner.suite.suites.length}, Test count: ${runner.suite.tests.length}`
            );
          });

          runner.on('fail', (test: any, err: Error) => {
            console.error('[SB Test] Test failed:', test.title, err.message);
          });

          runner.on('end', () => {
            console.log('[SB Test] Mocha runner ended.');
          });
        } catch (err) {
          reject(err);
        }
      })
      .catch((err) => reject(err));
  });
}
