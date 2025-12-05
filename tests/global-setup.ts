// tests/global-setup.ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';

const execPromise = promisify(exec);

async function globalSetup() {
  console.log('Starting services using run.sh...');
  
  try {
    // Start services using pm2 in the background
    const { stdout, stderr } = await execPromise('./run.sh restart');
    if (stdout) console.log('stdout:', stdout);
    if (stderr) console.error('stderr:', stderr);
  } catch (error: any) {
    console.error('Error executing run.sh restart:', error);
    if (error.stdout) console.error('stdout:', error.stdout);
    if (error.stderr) console.error('stderr:', error.stderr);
    // Re-throw the error to fail the setup
    throw error;
  }

  console.log('Services started. Waiting for them to become available...');

  // Wait for the frontend and backend to be ready
  await Promise.all([
    waitForUrl('http://localhost:3000', 'Frontend'),
    waitForUrl('http://localhost:2024/docs', 'Backend'), // The /docs endpoint is a good health check for FastAPI
  ]);

  console.log('Frontend and Backend are available. Starting tests.');
}

async function waitForUrl(url: string, serviceName: string, timeout = 60000) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await page.goto(url, { timeout: 2000 });
      if (response && response.ok()) {
        console.log(`✅ ${serviceName} is up and running at ${url}`);
        await browser.close();
        return;
      }
    } catch (error) {
      // Ignore errors and retry
    }
    await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2 seconds before retrying
  }

  await browser.close();
  throw new Error(`Timeout: ${serviceName} was not available at ${url} within ${timeout / 1000}s`);
}

export default globalSetup;
