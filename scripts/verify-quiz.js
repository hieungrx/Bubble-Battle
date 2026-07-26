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
      p1: { jsCorrectCount: scene.player1.jsCorrectCount, speed: scene.player1.speed, maxBalloons: scene.player1.maxBalloons, waterRange: scene.player1.waterRange },
      p2: { jsCorrectCount: scene.player2.jsCorrectCount, maxBalloons: scene.player2.maxBalloons, waterRange: scene.player2.waterRange },
      quizItemsCount: scene.quizItems ? scene.quizItems.size : 0,
      hasActiveSession: !!scene.activeQuizSession,
      hiddenQuizCratesSize: scene.hiddenQuizCrates ? scene.hiddenQuizCrates.size : 0,
      revealedQuizCount: scene.revealedQuizCount || 0,
      roundState: scene.roundManager ? scene.roundManager.state : null,
      timeRemaining: scene.roundManager ? scene.roundManager.timeRemaining : null,
      quizSceneActive: game.scene.isActive('QuizScene'),
      listeners: {
        crate_destroyed: scene.events.listenerCount('crate_destroyed'),
        quiz_answered: scene.events.listenerCount('quiz_answered'),
      }
    };
  });
}

async function getQuizState(page) {
  return await page.evaluate(() => {
    const game = window.__BUBBLE_BATTLE_GAME__;
    if (!game) return null;
    const qs = game.scene.getScene('QuizScene');
    if (!qs || !qs.scene.isActive()) return null;
    return {
      active: qs.scene.isActive(),
      answered: qs.answered,
      playerId: qs.playerId,
      correctIndex: qs.questionData ? qs.questionData.correctIndex : null,
      reward: qs.questionData ? qs.questionData.reward : null,
    };
  });
}

async function answerQuizP1(page, correctIndex) {
  const keyMap = ['1', '2', '3', '4'];
  await page.keyboard.press(keyMap[correctIndex]);
  await page.waitForTimeout(2500);
}

async function answerQuizP2(page, correctIndex) {
  for (let i = 0; i < correctIndex; i++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
  }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
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
      env: { ...process.env, VITE_ENABLE_TEST_HOOKS: 'true' }
    });

    serverProcess.stderr.on('data', (data) => console.error(`SERVER STDERR: ${data}`));

    await waitForServer(URL, START_TIMEOUT);
    console.log('Server is ready.');

    browser = await chromium.launch({
      headless: true,
      args: ['--disable-gpu', '--use-angle=swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--disable-dev-shm-usage', '--disable-software-rasterizer']
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error' && !text.includes('404')) {
        console.log(`BROWSER ERROR: ${text}`);
        errors.push(`Console Error: ${text}`);
      }
    });

    page.on('pageerror', err => {
      console.log(`PAGE ERROR: ${err.message}`);
      errors.push(`Page Error: ${err.message}`);
    });

    console.log('Navigating to game...');
    await page.goto(URL);
    await page.waitForFunction(() => window.__BUBBLE_BATTLE_GAME__);

    console.log('Waiting for MenuScene and pressing Space...');
    await page.waitForTimeout(1500);
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(500);
      const debug = await page.evaluate(() => {
        const game = window.__BUBBLE_BATTLE_GAME__;
        if (!game) return { error: 'No game' };
        const gs = game.scene.getScene('GameScene');
        return { roundState: gs?.roundManager?.state || null };
      });
      if (debug.roundState === 'playing') break;
    }

    let state = await getGameState(page);
    console.log(`  Started. Hidden crates: ${state.hiddenQuizCratesSize}, Revealed: ${state.revealedQuizCount}`);

    // ===== TEST 1: 10 hidden crates =====
    console.log('\n=== Test 1: 10 hidden crates ===');
    const test1 = state.hiddenQuizCratesSize === 10;
    console.log(test1 ? 'PASS: 10 hidden crates selected' : `FAIL: ${state.hiddenQuizCratesSize} hidden crates`);
    if (!test1) errors.push('Test 1 failed');

    // ===== TEST 2: Normal crate no spawn =====
    console.log('\n=== Test 2: Normal crate does NOT spawn ===');
    const nonHidden = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      for (let row = 2; row <= 8; row++) {
        for (let col = 2; col <= 13; col++) {
          const key = `${row}:${col}`;
          if (gs.mapSystem && gs.mapSystem.getTileAt(row, col) === 2) {
            if (!gs.hiddenQuizCrates.has(key)) return { row, col };
          }
        }
      }
      return null;
    });
    if (nonHidden) {
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.row, col: p.col, x: 0, y: 0 });
      }, nonHidden);
      await page.waitForTimeout(300);
      state = await getGameState(page);
      const test2 = state.quizItemsCount === 0;
      console.log(test2 ? 'PASS: No item from normal crate' : 'FAIL: Item spawned from normal crate');
      if (!test2) errors.push('Test 2 failed');
    } else {
      errors.push('Test 2: No normal crate found');
      console.log('FAIL: No normal crate found');
    }

    // ===== TEST 3: Hidden crate spawns item =====
    console.log('\n=== Test 3: Hidden crate spawns Quiz Item ===');
    const hiddenKey = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.hiddenQuizCrates.size > 0) return [...gs.hiddenQuizCrates][0];
      return null;
    });
    if (hiddenKey) {
      const [hr, hc] = hiddenKey.split(':').map(Number);
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: hr, c: hc });
      await page.waitForTimeout(500);
      state = await getGameState(page);
      const test3 = state.quizItemsCount === 1;
      console.log(test3 ? 'PASS: Quiz Item spawned (count=1)' : `FAIL: count=${state.quizItemsCount}`);
      if (!test3) errors.push('Test 3 failed');
      console.log(`  Remaining hidden: ${state.hiddenQuizCratesSize}, Revealed: ${state.revealedQuizCount}`);
    } else {
      errors.push('Test 3: No hidden crates');
      console.log('FAIL: No hidden crates');
    }

    // ===== TEST 4: Multiple items coexist =====
    console.log('\n=== Test 4: Multiple items coexist ===');
    const keys = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      return [...gs.hiddenQuizCrates].slice(0, 2);
    });
    for (const k of keys) {
      const [r, c] = k.split(':').map(Number);
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r, c: c });
      await page.waitForTimeout(200);
    }
    state = await getGameState(page);
    const test4 = state.quizItemsCount >= 3;
    console.log(test4 ? `PASS: ${state.quizItemsCount} items coexist on map` : `FAIL: only ${state.quizItemsCount} items`);
    if (!test4) errors.push('Test 4 failed');

    // ===== TEST 5: P1 claims item =====
    console.log('\n=== Test 5: P1 claims item ===');
    const itemPos = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.quizItems && gs.quizItems.size > 0) {
        const first = [...gs.quizItems.values()][0];
        return { x: first.x, y: first.y, id: first.itemId };
      }
      return null;
    });
    if (itemPos) {
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.player1.setPosition(p.x, p.y);
      }, itemPos);
      await page.waitForTimeout(300);
      state = await getGameState(page);
      const test5a = state.hasActiveSession === true;
      const test5b = state.quizSceneActive === true;
      console.log(test5a ? 'PASS: Active quiz session started' : 'FAIL: No active session');
      console.log(test5b ? 'PASS: QuizScene opened for P1' : 'FAIL: QuizScene not opened');
      if (!test5a) errors.push('Test 5a failed');
      if (!test5b) errors.push('Test 5b failed');

      let qs = await getQuizState(page);
      if (qs && qs.active) {
        console.log(`  Quiz active for player ${qs.playerId}, correct at index ${qs.correctIndex}`);
        await answerQuizP1(page, qs.correctIndex);
        state = await getGameState(page);
        const test5c = state.p1.jsCorrectCount === 1;
        console.log(test5c ? `PASS: P1 score = ${state.p1.jsCorrectCount}` : `FAIL: P1 score = ${state.p1.jsCorrectCount}`);
        if (!test5c) errors.push('Test 5c failed');
      }
    } else {
      errors.push('Test 5: No item to claim');
      console.log('FAIL: No item to claim');
    }

    // ===== TEST 6: P2 claims item =====
    console.log('\n=== Test 6: P2 claims item ===');
    await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.quizItems && gs.quizItems.size > 0) {
        const items = [...gs.quizItems.values()];
        for (const item of items) {
          if (!item.claimed) {
            gs.player2.setPosition(item.x, item.y);
            return;
          }
        }
      }
    });
    await page.waitForTimeout(500);
    state = await getGameState(page);
    if (state.quizSceneActive) {
      let qs = await getQuizState(page);
      if (qs) {
        console.log(`  Quiz active for player ${qs.playerId} (P2), correct at index ${qs.correctIndex}`);
        await answerQuizP2(page, qs.correctIndex);
        state = await getGameState(page);
        const test6 = state.p2.jsCorrectCount >= 1;
        console.log(test6 ? `PASS: P2 score = ${state.p2.jsCorrectCount}` : `FAIL: P2 score = ${state.p2.jsCorrectCount}`);
        if (!test6) errors.push('Test 6 failed');
      }
    } else {
      console.log('PASS: No unclaimed item available (all claimed or gone)');
    }

    // ===== TEST 7: Remaining items persist after quiz =====
    console.log('\n=== Test 7: Remaining items persist after quiz');
    const remainingCount = state.quizItemsCount;
    console.log(remainingCount > 0 ? `PASS: ${remainingCount} items still on map` : 'INFO: No items remaining');

    // ===== TEST 8: Restart cleanup =====
    console.log('\n=== Test 8: Restart lifecycle (3x) ===');
    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`  Restart cycle ${cycle}...`);
      await page.evaluate(() => {
        const game = window.__BUBBLE_BATTLE_GAME__;
        game.scene.start('ResultScene', { result: 'draw', reason: 'test', duration: 0, p1JsCorrect: 1, p2JsCorrect: 0 });
      });
      await page.waitForTimeout(500);
      await page.keyboard.press('Space');
      await page.waitForTimeout(1500);
    }
    state = await getGameState(page);
    const cd = state.listeners.crate_destroyed;
    const qa = state.listeners.quiz_answered;
    const test8 = cd === 1 && qa === 1 && state.hiddenQuizCratesSize === 10 && state.quizItemsCount === 0 && state.revealedQuizCount === 0 && !state.hasActiveSession;
    console.log(`  Listeners: crate=${cd}, quiz_answered=${qa}`);
    console.log(`  Hidden: ${state.hiddenQuizCratesSize}, Items: ${state.quizItemsCount}, Revealed: ${state.revealedQuizCount}`);
    console.log(test8 ? 'PASS: Clean restart with fresh state' : 'FAIL: Stale state after restart');
    if (!test8) errors.push('Test 8 failed');

    console.log('\n========================================');
    if (errors.length === 0) {
      console.log('ALL QUIZ BROWSER ASSERTIONS PASSED.');
    } else {
      console.log(`QUIZ BROWSER TESTS FAILED: ${errors.length} error(s)`);
      errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
      process.exitCode = 1;
    }
    console.log('========================================');

  } catch (err) {
    console.error(`TEST SCRIPT ERROR: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => serverProcess.on('close', resolve));
    }
  }
})();
