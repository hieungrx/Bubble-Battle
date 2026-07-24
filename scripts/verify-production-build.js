import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4180;
const URL = `http://localhost:${PORT}`;

async function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not become ready: ${url}`);
}

(async () => {
  let serverProcess;
  let browser;

  try {
    console.log('Starting preview server for production test...');
    serverProcess = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'preview', '--', '--port', PORT.toString(), '--strictPort', '--outDir', 'dist'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      shell: true
    });

    await waitForServer(URL);
    console.log('Server is ready.');

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(URL);
    await page.waitForTimeout(2000); // Wait for boot and menu

    const hasTestHook = await page.evaluate(() => {
        return window.__BUBBLE_BATTLE_GAME__ !== undefined || window.__BUBBLE_BATTLE_TEST_API__ !== undefined;
    });

    if (hasTestHook) {
        console.error('ERROR: Production build exposes test hooks (window.__BUBBLE_BATTLE_GAME__ or window.__BUBBLE_BATTLE_TEST_API__)');
        process.exitCode = 1;
    } else {
        console.log('Assertion passed: Production build DOES NOT expose test hooks.');
    }
  } catch (err) {
    console.error('Production test error:', err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
    if (serverProcess && !serverProcess.killed) {
      if (/^win/.test(process.platform)) {
        spawn('taskkill', ['/PID', serverProcess.pid, '/T', '/F']);
      } else {
        serverProcess.kill();
      }
    }
  }
})();
