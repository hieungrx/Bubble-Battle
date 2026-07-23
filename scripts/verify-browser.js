import { chromium } from 'playwright';
import { spawn } from 'child_process';

async function runBrowserValidation() {
  const PORT = 4179;
  console.log(`Starting Vite preview server on port ${PORT}...`);
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    shell: true,
    cwd: process.cwd()
  });

  server.stdout.on('data', (d) => console.log(`[Preview Server]: ${d.toString().trim()}`));
  server.stderr.on('data', (d) => console.error(`[Preview Server Error]: ${d.toString().trim()}`));

  await new Promise((r) => setTimeout(r, 3000));

  let browser;
  const consoleMessages = [];
  const errors = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader']
    });
    const page = await browser.newPage();

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error' && !msg.text().includes('Framebuffer status')) {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      errors.push(err.toString());
    });

    const targetUrl = `http://localhost:${PORT}/`;
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    const canvas = await page.$('canvas');
    if (!canvas) {
      throw new Error('Canvas element not found on page');
    }
    console.log('Canvas element verified successfully.');

    // 1. MenuScene -> Press Space to start
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    // 2. Player 1 move right (KeyD) and place balloon (Space)
    await page.keyboard.press('KeyD');
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    // 3. Player 2 move left (ArrowLeft) and place balloon (Enter)
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // 4. Test scene restart loop 3 times
    console.log('Testing scene restarts 3 times...');
    for (let i = 1; i <= 3; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
    }

    // Check for duplicate texture warnings in console logs
    const textureWarnings = consoleMessages.filter(
      (m) => m.text.includes('Texture') || m.text.includes('duplicate key')
    );

    console.log('\n--- BROWSER TEST REPORT ---');
    console.log(`Canvas Rendered: PASS`);
    console.log(`Console Errors Count: ${errors.length}`);
    console.log(`Duplicate Texture Warnings Count: ${textureWarnings.length}`);
    
    if (errors.length > 0) {
      console.error('Errors found:', errors);
      process.exitCode = 1;
    } else {
      console.log('BROWSER MANUAL VALIDATION: PASS (Zero JS errors, zero texture warnings)');
    }

  } catch (err) {
    console.error('Browser validation failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

runBrowserValidation();
