import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 4179;
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
  try {
    console.log('Starting preview server...');
    serverProcess = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'preview:test'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      shell: true
    });

    await waitForServer(URL);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(URL);
    await page.waitForTimeout(2000); // Wait for boot and menu

    const screenshotsDir = path.join(__dirname, '../docs/screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    console.log('Capturing menu.png...');
    await page.screenshot({ path: path.join(screenshotsDir, 'menu.png') });

    await page.keyboard.press('Space');
    await page.waitForTimeout(1500); // Wait for GameScene

    console.log('Capturing gameplay.png...');
    await page.screenshot({ path: path.join(screenshotsDir, 'gameplay.png') });

    await browser.close();
    console.log('Screenshots captured successfully.');
  } catch (err) {
    console.error('Screenshot error:', err);
    process.exitCode = 1;
  } finally {
    if (serverProcess && !serverProcess.killed) {
      if (/^win/.test(process.platform)) {
        spawn('taskkill', ['/PID', serverProcess.pid, '/T', '/F']);
      } else {
        serverProcess.kill();
      }
    }
  }
})();
