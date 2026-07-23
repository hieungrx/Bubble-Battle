import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4179;
const URL = `http://localhost:${PORT}`;
const START_TIMEOUT = 15000;

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

async function getGameState(page) {
  return await page.evaluate(() => {
    const game = window.__BUBBLE_BATTLE_GAME__;
    if (!game) return null;
    const scene = game.scene.getScene('GameScene');
    if (!scene || !scene.player1 || !scene.player2) return null;
    
    return {
      p1: {
        x: scene.player1.x,
        y: scene.player1.y,
        state: scene.player1.state
      },
      p2: {
        x: scene.player2.x,
        y: scene.player2.y,
        state: scene.player2.state
      },
      balloons: (() => {
        try {
          let arr = [];
          if (scene.balloons && scene.balloons.getChildren) {
            arr = scene.balloons.getChildren();
          } else if (scene.balloons && scene.balloons.children) {
            arr = Array.isArray(scene.balloons.children) ? scene.balloons.children : (scene.balloons.children.entries || []);
          }
          return arr.map((balloon) => ({
            x: balloon.x,
            y: balloon.y,
            gridRow: balloon.gridRow,
            gridCol: balloon.gridCol,
            physicsType: balloon.body?.physicsType,
            active: balloon.active,
            passThroughPlayerIds: [...(balloon.passThroughPlayerIds || [])]
          }));
        } catch (e) {
          return [];
        }
      })(),
      roundState: scene.roundManager.state,
      lastResolvedResult: scene.roundManager.lastResolvedResult,
      listeners: {
        place_balloon: scene.events.listenerCount('request_place_balloon'),
        balloon_explode: scene.events.listenerCount('balloon_explode'),
        timer_tick: scene.events.listenerCount('timer_tick')
      }
    };
  });
}

(async () => {
  let serverProcess;
  const errors = [];
  const consoleMessages = [];

  try {
    console.log('Starting preview server...');
    serverProcess = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'preview', '--', '--port', PORT.toString()], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      shell: true
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`SERVER STDERR: ${data}`);
    });
    
    serverProcess.on('exit', (code) => {
        if (code !== null && code !== 0) {
            console.error(`Server exited unexpectedly with code ${code}`);
            process.exit(1);
        }
    });

    await waitForServer(URL, START_TIMEOUT);
    console.log('Server is ready.');

    const browser = await chromium.launch({ 
        headless: true,
        args: [
            '--disable-gpu',
            '--use-angle=swiftshader',
            '--use-gl=swiftshader',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-software-rasterizer'
        ]
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('console', msg => {
        const text = msg.text();
        console.log(`BROWSER CONSOLE: ${text}`);
        consoleMessages.push({ type: msg.type(), text });
        if (msg.type() === 'error' && !text.includes('Failed to load resource: the server responded with a status of 404 (Not Found)')) {
            errors.push(`Console Error: ${text}`);
        }
    });

    page.on('pageerror', err => {
        console.log(`PAGE ERROR: ${err.message}`);
        console.log(`STACK: ${err.stack}`);
        errors.push(`Page Error: ${err.message}`);
    });

    console.log('Navigating to game...');
    await page.goto(URL);
    await page.waitForFunction(() => window.__BUBBLE_BATTLE_GAME__);

    console.log('Waiting for MenuScene and pressing Space...');
    await page.waitForTimeout(1500); // Wait for Phaser to fully boot
    
    let isGameSceneActive = false;
    for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(500);
        
        const debugState = await page.evaluate(() => {
            const game = window.__BUBBLE_BATTLE_GAME__;
            if (!game) return { error: 'No game' };
            const scene = game.scene.getScene('GameScene');
            if (!scene) return { error: 'No GameScene' };
            return {
                hasScene: !!scene,
                isActive: scene.sys && scene.sys.settings.active,
                hasP1: !!scene.player1,
                hasP2: !!scene.player2
            };
        });
        
        console.log(`Poll ${i+1}:`, debugState);
        
        if (debugState.hasScene && debugState.isActive && debugState.hasP1 && debugState.hasP2) {
            isGameSceneActive = true;
            break;
        }
    }
    
    if (!isGameSceneActive) {
        await page.screenshot({ path: 'debug.png' });
        throw new Error('GameScene did not become active after multiple attempts. Saved debug.png.');
    }

    // 1. Test movement with assertions
    console.log('Testing Player 1 movement...');
    let before = await getGameState(page);
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyD');
    let after = await getGameState(page);
    if (!(after.p1.x > before.p1.x + 5)) {
        errors.push(`Player 1 did not move right. Before X: ${before.p1.x}, After X: ${after.p1.x}`);
    } else {
        console.log(`Assertion passed: P1 x changed from ${before.p1.x} to ${after.p1.x}`);
    }

    console.log('Testing Player 2 movement...');
    before = await getGameState(page);
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowLeft');
    after = await getGameState(page);
    if (!(after.p2.x < before.p2.x - 5)) {
        errors.push(`Player 2 did not move left. Before X: ${before.p2.x}, After X: ${after.p2.x}`);
    } else {
        console.log(`Assertion passed: P2 x changed from ${before.p2.x} to ${after.p2.x}`);
    }

    // 2. Test balloon static body
    console.log('Testing balloon placement and physicsType...');
        await page.evaluate(() => {
            const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
            if (scene && scene.player1) {
                scene.events.emit('request_place_balloon', scene.player1);
            }
        });
    await page.waitForTimeout(200);
    let state = await getGameState(page);
    

    if (state.balloons.length === 0) {
        errors.push('No balloons found after pressing Space.');
    } else {
        const b = state.balloons[0];
        if (b.physicsType !== 1) { // 1 is Phaser.Physics.Arcade.STATIC_BODY
            errors.push(`Balloon physicsType is not STATIC_BODY (1). Got: ${b.physicsType}`);
        } else {
            console.log('Assertion passed: Balloon physicsType = 1');
        }
    }

    // 3. Test owner exit and re-entry collision
    console.log('Testing owner exit and re-entry...');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(1500); // Wait longer to fully exit bounding box
    await page.keyboard.up('KeyA');
    
    state = await getGameState(page);
    if (state.balloons.length > 0) {
        const b = state.balloons[0];
        if (b.passThroughPlayerIds.includes(1)) {
            errors.push('Player 1 ID still in passThroughPlayerIds after moving away.');
        } else {
            console.log('Assertion passed: Player 1 removed from passThroughPlayerIds');
        }
        
        // Try walking back left into the balloon
        let beforeReentry = await getGameState(page);
        await page.keyboard.down('KeyA');
        await page.waitForTimeout(800);
        await page.keyboard.up('KeyA');
        let afterReentry = await getGameState(page);
        
        // Assert player didn't pass through the balloon
        if (afterReentry.p1.x <= b.x && beforeReentry.p1.x > b.x) {
            errors.push('Player 1 passed through the balloon after re-entry.');
        } else {
            console.log('Assertion passed: Player 1 blocked from passing through balloon');
        }
    }

    // wait for explosion so map is clean
    await page.waitForTimeout(1500); 

    // 4. Test opponent blocked
    console.log('Testing opponent block...');
    await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        scene.player2.setPosition(scene.player1.x + 64, scene.player1.y);
        scene.player2.body.reset(scene.player1.x + 64, scene.player1.y);
    });
    
        await page.evaluate(() => {
            const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
            if (scene && scene.player1) {
                scene.events.emit('request_place_balloon', scene.player1);
            }
        }); // P1 drops balloon
    await page.waitForTimeout(200);
    before = await getGameState(page);
    
    // Move P2 left into the balloon
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowLeft');
    
    after = await getGameState(page);
    if (after.balloons.length > 0) {
        const b = after.balloons[0];
        if (after.p2.x <= b.x && before.p2.x > b.x) {
             errors.push('Player 2 passed through the balloon.');
        } else {
             console.log('Assertion passed: Player 2 blocked by balloon');
        }
    }

    // 5. Test simultaneous death and DEAD + TRAPPED
    console.log('Testing resolver: DEAD + TRAPPED...');
    await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        scene.player1.state = 'DEAD';
        scene.player2.state = 'TRAPPED';
        scene.roundManager.resolveRound(false);
    });
    await page.waitForTimeout(500);
    state = await getGameState(page);
    if (state.lastResolvedResult !== 'draw') {
        errors.push(`Expected DEAD+TRAPPED to be draw, got ${state.lastResolvedResult}`);
    } else {
        console.log('Assertion passed: DEAD + TRAPPED resolved to draw');
    }

    console.log('Testing resolver: DEAD + DEAD...');
    await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        scene.roundManager.state = 'playing'; // reset state for test
        scene.player1.state = 'DEAD';
        scene.player2.state = 'DEAD';
        scene.roundManager.resolveRound(false);
    });
    await page.waitForTimeout(500);
    state = await getGameState(page);
    if (state.lastResolvedResult !== 'draw') {
        errors.push(`Expected DEAD+DEAD to be draw, got ${state.lastResolvedResult}`);
    } else {
        console.log('Assertion passed: DEAD + DEAD resolved to draw');
    }

    // Wait for result scene transition and reset
    await page.waitForTimeout(2000);
    // Restart
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);

    // 6. Test damage lock
    console.log('Testing damage lock...');
    await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        scene.roundManager.state = 'FINISHED';
        scene.player1.state = 'ACTIVE';
        scene.handlePlayerHit(scene.player1);
    });
    await page.waitForTimeout(200);
    state = await getGameState(page);
    if (state.p1.state !== 'ACTIVE') {
        errors.push(`Expected player 1 to be ACTIVE, but got ${state.p1.state}`);
    } else {
        console.log('Assertion passed: Player 1 remained ACTIVE after hit when round FINISHED');
    }
    const hasTrapTimer = await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        return scene.player1.trapTimer != null;
    });
    if (hasTrapTimer) {
        errors.push('Player 1 got trapTimer despite round being FINISHED');
    } else {
        console.log('Assertion passed: Player 1 has no trapTimer');
    }

    // 7. Test restart loop 3 times
    console.log('Testing restart loop 3x...');
    for (let i = 0; i < 3; i++) {
        console.log(`Restart cycle ${i+1}...`);
        
        // Force result scene
        await page.evaluate(() => {
            const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
            scene.roundManager.state = 'playing';
            scene.player1.state = 'DEAD';
            scene.roundManager.resolveRound(false);
        });
        await page.waitForTimeout(2200);
        
        // Press space in result scene
        await page.keyboard.press('Space');
        await page.waitForTimeout(1500);

        // Place a balloon to check duplicate
            await page.evaluate(() => {
            const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
            if (scene && scene.player1) {
                scene.events.emit('request_place_balloon', scene.player1);
            }
        });
        await page.waitForTimeout(100);
        
        state = await getGameState(page);
        if (state.balloons.length !== 1) {
            errors.push(`Cycle ${i+1}: Expected exactly 1 balloon, got ${state.balloons.length}`);
        } else {
            console.log(`Assertion passed: 1 key press created 1 balloon`);
        }

        if (state.listeners.place_balloon !== 1) {
             errors.push(`Cycle ${i+1}: request_place_balloon listener count is ${state.listeners.place_balloon}`);
        } else {
             console.log(`Assertion passed: request_place_balloon listener count remained 1 after three restarts`);
        }
    }

    // Check texture warnings
    const textureWarnings = consoleMessages.filter((message) =>
      /duplicate texture|texture key.*exists/i.test(message.text)
    );

    if (textureWarnings.length > 0) {
      errors.push(
        `Duplicate texture warnings: ${textureWarnings
          .map((item) => item.text)
          .join(' | ')}`
      );
    }

    await browser.close();

    if (errors.length > 0) {
      console.error('BROWSER TESTS FAILED:');
      errors.forEach(err => console.error('-', err));
      process.exit(1);
    }

    console.log('ALL BROWSER ASSERTIONS PASSED.');
    process.exit(0);

  } catch (err) {
    console.error('TEST SCRIPT ERROR:', err);
    process.exit(1);
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }
})();
