import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Creates, migrates and empties the browser-test database (nestwise_e2e) before the run. */
export default function globalSetup() {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  execFileSync(process.execPath, ['--env-file-if-exists=.env.local', '--import', 'tsx', 'scripts/e2e-db.ts'], {
    cwd: root,
    env: { ...process.env, TEST_DB_NAME: 'nestwise_e2e', TEST_DATABASE_URL: '' },
    stdio: 'inherit',
  });
}
