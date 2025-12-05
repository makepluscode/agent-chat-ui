// tests/global-teardown.ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execPromise = promisify(exec);

async function globalTeardown() {
  console.log('Stopping services using run.sh...');
  await execPromise('./run.sh stop');
  console.log('Services stopped.');
}

export default globalTeardown;
