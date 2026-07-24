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
        state: scene.player1.state,
        hasTrapTimer: scene.player1.trapTimer != null
      },
      p2: {
        x: scene.player2.x,
        y: scene.player2.y,
        state: scene.player2.state,
        hasTrapTimer: scene.player2.trapTimer != null
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
            passThroughPlayerIds: [...(balloon.passThroughPlayerIds || [])],
            rightEdge: balloon.body?.right,
            leftEdge: balloon.body?.left,
            bodyWidth: balloon.body?.width,
            bodyHeight: balloon.body?.height
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
        timer_tick: scene.events.listenerCount('timer_tick'),
        player_dead: scene.events.listenerCount('player_dead')
      }
    };
  });
}

(async () => {
  let serverProcess;
  const errors = [];
  const consoleMessages = [];
  let browser;

  try {
    console.log('Starting preview server...');
    serverProcess = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'preview:test'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      shell: true,
      env: {
        ...process.env,
        VITE_ENABLE_TEST_HOOKS: 'true'
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`SERVER STDERR: ${data}`);
    });

    await waitForServer(URL, START_TIMEOUT);
    console.log('Server is ready.');

    browser = await chromium.launch({ 
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
        
        if (debugState.hasScene && debugState.isActive && debugState.hasP1 && debugState.hasP2) {
            isGameSceneActive = true;
            break;
        }
    }
    
    if (!isGameSceneActive) {
        throw new Error('GameScene did not become active after multiple attempts.');
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
    // Pause balloon fuse timer so it doesn't explode during assertion
    await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        scene.balloons.getChildren()[0].fuseTimer.paused = true;
    });

    await page.keyboard.down('KeyA');
    await page.waitForTimeout(1500); // exit bounding box to left
    await page.keyboard.up('KeyA');
    
    state = await getGameState(page);
    if (state.balloons.length > 0) {
        const b = state.balloons[0];
        if (b.passThroughPlayerIds.includes(1)) {
            errors.push('Player 1 ID still in passThroughPlayerIds after moving away.');
        } else {
            console.log('Assertion passed: Player 1 removed from passThroughPlayerIds');
        }
        
        // Try walking back right into the balloon
        await page.keyboard.down('KeyD');
        await page.waitForTimeout(800);
        await page.keyboard.up('KeyD');
        let afterReentry = await getGameState(page);
        
        // Use exposed body coordinates for check. Balloon is at right of player.
        const p1Right = await page.evaluate(() => {
             return window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene').player1.body.right;
        });
        const balloonLeft = b.leftEdge;
        
        if (p1Right > balloonLeft + 10) {
            errors.push(`Player 1 passed through the balloon after re-entry. P1 right: ${p1Right}, Balloon left: ${balloonLeft}`);
        } else {
            console.log('Assertion passed: Player 1 blocked from passing through balloon');
        }
    }

    // Unpause and let explode
    await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        scene.player1.setPosition(400, 400);
        scene.player1.body.reset(400, 400);
        const balloon = scene.balloons.getChildren()[0];
        if (balloon) balloon.explode();
    });
    await page.waitForTimeout(1000); 

    // 4. Test opponent blocked
    console.log('Testing opponent block...');
    await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        scene.player1.setPosition(96, 96);
        scene.player1.body.reset(96, 96);
        scene.events.emit('request_place_balloon', scene.player1);
    });
    await page.waitForTimeout(200);

    // Pause new balloon timer
    await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        scene.balloons.getChildren()[0].fuseTimer.paused = true;
    });
    state = await getGameState(page);
    const balloonB = state.balloons[0];
    const startX = balloonB.x + 64;

    await page.evaluate((sx) => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        const b = scene.balloons.getChildren()[0];
        scene.player2.setPosition(sx, b.y);
        scene.player2.body.reset(sx, b.y);
    }, startX);

    // Move P2 left into the balloon
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowLeft');
    
    const p2Left = await page.evaluate(() => {
        return window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene').player2.body.left;
    });

    if (p2Left < balloonB.rightEdge - 10) {
         errors.push(`Player 2 passed through the balloon. P2 Left: ${p2Left}, Balloon Right Edge: ${balloonB.rightEdge}`);
    } else {
         console.log('Assertion passed: Player 2 blocked by balloon');
    }

    // Move P2 away before explosion so they don't die and end the round
    await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        scene.player2.setPosition(400, 400);
        scene.player2.body.reset(400, 400);
        const balloon = scene.balloons.getChildren()[0];
        if (balloon) balloon.explode();
    });
    await page.waitForTimeout(1000); 

    // 5. Test Explosion Propagation and Crate Destruction
    console.log('Testing Explosion Propagation (Crates)...');
    await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        // Clear map area temporarily for test
        scene.player1.setPosition(48 * 3 + 24, 48 * 3 + 24);
        scene.player1.body.reset(48 * 3 + 24, 48 * 3 + 24);
        scene.events.emit('request_place_balloon', scene.player1);
    });
    await page.waitForTimeout(200);
    const crateTestResult = await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        const balloon = scene.balloons.getChildren()[0];
        
        // Move P1 away so they don't get trapped
        scene.player1.setPosition(400, 400);
        scene.player1.body.reset(400, 400);

        // Force a crate to be right next to the balloon
        scene.mapSystem.crates.create(balloon.x + 48, balloon.y, 'crate');
        scene.mapSystem.mapData[balloon.gridRow][balloon.gridCol + 1] = 2; // TILE.CRATE
        
        balloon.explode();
        return {
            tileValue: scene.mapSystem.getTileAt(balloon.gridRow, balloon.gridCol + 1)
        }
    });
    await page.waitForTimeout(800); // let explosion finish
    if (crateTestResult.tileValue !== 0) { // TILE.FLOOR
        errors.push(`Expected crate to turn to FLOOR (0), got ${crateTestResult.tileValue}`);
    } else {
        console.log('Assertion passed: Crate destroyed by explosion');
    }

    // 6. Test Trap Lifecycle
    console.log('Testing Trap Lifecycle...');
    await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        const p1 = scene.player1;
        const p2 = scene.player2;

        p1.setPosition(400, 400);
        p1.body.reset(400, 400);
        p1.state = window.__BUBBLE_BATTLE_TEST_API__.states.player.ACTIVE;
        if (p1.trapTimer) {
            p1.trapTimer.remove(false);
            p1.trapTimer = null;
        }

        p2.setPosition(500, 500);
        p2.body.reset(500, 500);
        p2.state = window.__BUBBLE_BATTLE_TEST_API__.states.player.ACTIVE;
        if (p2.trapTimer) {
            p2.trapTimer.remove(false);
            p2.trapTimer = null;
        }

        scene.handlePlayerHit(p1, null);
    });
    await page.waitForTimeout(200);
    state = await getGameState(page);
    if (state.p1.state !== 'trapped') {
        errors.push(`Expected player to be 'trapped', got ${state.p1.state}`);
    } else {
        console.log('Assertion passed: Player state -> TRAPPED');
    }

    // Wait for trap duration to end (should be 3000ms, wait a bit more)
    await page.waitForTimeout(3200);
    state = await getGameState(page);
    if (state.p1.state !== 'dead') {
        errors.push(`Expected player to be 'dead', got ${state.p1.state}`);
    } else {
        console.log('Assertion passed: Player state -> DEAD');
    }

    // Wait for result scene transition and reset from the trap test
    await page.waitForTimeout(2000);
    await page.keyboard.press('Space'); // Restart
    await page.waitForTimeout(1500);

    // 7. Result flow tests
    console.log('Testing resolver: DEAD + TRAPPED...');
    await page.evaluate(() => {
        const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        const states = window.__BUBBLE_BATTLE_TEST_API__.states;
        scene.roundManager.state = states.round.PLAYING;
        scene.player1.state = states.player.DEAD;
        scene.player2.state = states.player.TRAPPED;
        scene.roundManager.resolveRound(false);
    });
    await page.waitForTimeout(500);
    state = await getGameState(page);
    if (state.lastResolvedResult !== 'draw') {
        errors.push(`Expected DEAD+TRAPPED to be draw, got ${state.lastResolvedResult}`);
    } else {
        console.log('Assertion passed: DEAD + TRAPPED resolved to draw');
    }

    // Wait for result scene transition and reset from the DEAD+TRAPPED test
    await page.waitForTimeout(2000);
    // Restart
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);

    // 8. Test restart loop logic
    console.log('Testing restart loop 3x...');
    for (let i = 0; i < 3; i++) {
        console.log(`Restart cycle ${i+1}...`);
        
        // Force result scene
        await page.evaluate(() => {
            const scene = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
            const states = window.__BUBBLE_BATTLE_TEST_API__.states;
            scene.roundManager.state = states.round.PLAYING;
            scene.player1.state = states.player.DEAD;
            scene.roundManager.resolveRound(false);
        });
        await page.waitForTimeout(2200);
        
        // Press space in result scene
        await page.keyboard.press('Space');
        await page.waitForTimeout(1500);

        state = await getGameState(page);

        if (state.balloons.length !== 0) {
            errors.push(`Cycle ${i+1}: Expected 0 balloons after restart, got ${state.balloons.length}`);
        } else {
            console.log(`Assertion passed: initial balloon count after restart: 0`);
        }
        
        // Place a balloon to check duplicate space actions didn't leak
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
            console.log(`Assertion passed: 1 action created 1 balloon`);
        }

        if (state.listeners.place_balloon !== 1 || state.listeners.timer_tick !== 1 || state.listeners.player_dead !== 1) {
             errors.push(`Cycle ${i+1}: listener counts are not 1: pb=${state.listeners.place_balloon}, tt=${state.listeners.timer_tick}, pd=${state.listeners.player_dead}`);
        } else {
             console.log(`Assertion passed: listener counts after restart 3: 1/1/1/1`);
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

    process.exitCode = errors.length > 0 ? 1 : 0;

    if (errors.length > 0) {
      console.error('BROWSER TESTS FAILED:');
      errors.forEach(err => console.error('-', err));
    } else {
      console.log('ALL BROWSER ASSERTIONS PASSED.');
    }

  } catch (err) {
    console.error('TEST SCRIPT ERROR:', err);
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
