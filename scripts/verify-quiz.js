import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { JS_QUESTIONS } from '../src/data/jsQuestions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4179;
const URL = `http://localhost:${PORT}`;
const START_TIMEOUT = 15000;

let passedTests = 0;
let executedTests = 0;
function assertCondition(condition, testName, message, errors) {
  executedTests++;
  if (!condition) {
    errors.push(`${testName} FAIL: ${message}`);
    console.log(`FAIL: ${testName} - ${message}`);
    return false;
  }
  passedTests++;
  console.log(`PASS: ${testName} - ${message}`);
  return true;
}

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
        jsCorrectCount: scene.player1.jsCorrectCount,
        speed: scene.player1.speed,
        maxBalloons: scene.player1.maxBalloons,
        waterRange: scene.player1.waterRange,
        speedBoostActive: scene.player1.speedBoostActive,
        x: scene.player1.x,
        y: scene.player1.y,
        baseSpeed: scene.player1.baseSpeed ?? 150,
        speedBoostEndTime: scene.player1.speedBoostEndTime ?? null,
        speedBoostRemaining: scene.player1.getSpeedBoostRemaining ? scene.player1.getSpeedBoostRemaining() : null,
      },
      p2: {
        jsCorrectCount: scene.player2.jsCorrectCount,
        speed: scene.player2.speed,
        maxBalloons: scene.player2.maxBalloons,
        waterRange: scene.player2.waterRange,
        speedBoostActive: scene.player2.speedBoostActive,
        x: scene.player2.x,
        y: scene.player2.y,
        baseSpeed: scene.player2.baseSpeed ?? 150,
        speedBoostEndTime: scene.player2.speedBoostEndTime ?? null,
        speedBoostRemaining: scene.player2.getSpeedBoostRemaining ? scene.player2.getSpeedBoostRemaining() : null,
      },
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
        quiz_item_despawned: scene.events.listenerCount('quiz_item_despawned'),
        power_up_granted: scene.events.listenerCount('power_up_granted'),
        speed_boost_ended: scene.events.listenerCount('speed_boost_ended'),
        timer_tick: scene.events.listenerCount('timer_tick'),
        request_place_balloon: scene.events.listenerCount('request_place_balloon'),
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
      p2SelectedIndex: qs.p2SelectedIndex
    };
  });
}

async function getItemDetails(page) {
  return await page.evaluate(() => {
    const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
    if (!gs || !gs.quizItems) return [];
    const items = [];
    for (const item of gs.quizItems.values()) {
      items.push({
        itemId: item.itemId,
        x: item.x,
        y: item.y,
        claimed: item.claimed,
        collected: item.collected,
        active: item.active,
        gridRow: item.gridRow,
        gridCol: item.gridCol,
        bodyEnabled: item.body ? item.body.enable : null,
        hasLifetimeTimer: !!item.lifetimeTimer
      });
    }
    return items;
  });
}

async function getUIBounds(page) {
  return await page.evaluate(() => {
    const game = window.__BUBBLE_BATTLE_GAME__;
    const qs = game.scene.getScene('QuizScene');
    if (!qs || !qs.scene.isActive()) return null;

    const result = { questionBounds: null, answerBoxes: [], overlayBounds: null, countdownBounds: null };

    const children = qs.children.list;
    for (const child of children) {
      if (!child || !child.getBounds) continue;
      const bounds = child.getBounds();
      if (child.type === 'Text') {
        const text = child.text || '';
        if (text.includes('Quiz') || text.includes('P1') || text.includes('P2')) continue;
        if (/^\d+s$|^\u23F1/.test(text) || text.includes('s')) {
          result.countdownBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
          continue;
        }
        if (text.includes('CH') || text.includes('NH') || text.includes('KH') || text.includes('HẾT')) {
          result.overlayBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
          continue;
        }
        if (text.includes('. ') || text.includes('⏱')) continue;
      }
    }

    return result;
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

async function startGame(page) {
  await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
}

async function restartGame(page) {
  await page.evaluate(() => {
    const game = window.__BUBBLE_BATTLE_GAME__;
    game.scene.start('ResultScene', { result: 'draw', reason: 'test', duration: 0, p1JsCorrect: 0, p2JsCorrect: 0 });
  });
  await page.waitForTimeout(800);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
}

(async () => {
  let serverProcess;
  const errors = [];
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

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`BROWSER ERROR: ${msg.text()}`);
        consoleErrors.push(`Console Error: ${msg.text()}`);
      }
    });
    page.on('pageerror', err => {
      console.log(`PAGE ERROR: ${err.message}`);
      consoleErrors.push(`Page Error: ${err.message}`);
    });

    console.log('Navigating to game...');
    await page.goto(URL);
    await page.waitForFunction(() => window.__BUBBLE_BATTLE_GAME__);
    await page.waitForTimeout(1500);

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(500);
      const debug = await page.evaluate(() => {
        const game = window.__BUBBLE_BATTLE_GAME__;
        if (!game) return null;
        const gs = game.scene.getScene('GameScene');
        return { roundState: gs?.roundManager?.state || null };
      });
      if (debug && debug.roundState === 'playing') break;
    }

    let state = await getGameState(page);
    console.log(`  Started. Hidden crates: ${state.hiddenQuizCratesSize}`);

    // ===== TEST 1: Exact 10 hidden crates =====
    console.log('\n=== Test 1: Exact 10 hidden crates ===');
    assertCondition(state.hiddenQuizCratesSize === 10, 'Test 1',
      `Expected 10 hidden crates, got ${state.hiddenQuizCratesSize}`, errors);

    // ===== TEST 2: Normal crate no spawn =====
    console.log('\n=== Test 2: Normal crate does NOT spawn item ===');
    const normalCrate = await page.evaluate(() => {
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
    if (!normalCrate) {
      assertCondition(false, 'Test 2', 'No normal crate found', errors);
    } else {
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.row, col: p.col, x: 0, y: 0 });
      }, normalCrate);
      await page.waitForTimeout(300);
      state = await getGameState(page);
      assertCondition(state.quizItemsCount === 0, 'Test 2',
        `Expected 0 items from normal crate, got ${state.quizItemsCount}`, errors);
    }

    // ===== TEST 3: Hidden crate spawns exactly 1 item =====
    console.log('\n=== Test 3: Hidden crate spawns exactly 1 item ===');
    const hiddenKey = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.hiddenQuizCrates.size > 0) return [...gs.hiddenQuizCrates][0];
      return null;
    });
    if (!hiddenKey) {
      assertCondition(false, 'Test 3', 'No hidden crates', errors);
    } else {
      const [hr, hc] = hiddenKey.split(':').map(Number);
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: hr, c: hc });
      await page.waitForTimeout(500);
      state = await getGameState(page);
      assertCondition(state.quizItemsCount === 1, 'Test 3',
        `Expected 1 item from hidden crate, got ${state.quizItemsCount}`, errors);
      if (state.quizItemsCount === 1) {
        const itemDetails = await getItemDetails(page);
        assertCondition(itemDetails.length === 1, 'Test 3',
          `Item at grid (${itemDetails[0]?.gridRow},${itemDetails[0]?.gridCol})`, errors);
      }
    }

    // ===== TEST 4: Multiple exact items (3) =====
    console.log('\n=== Test 4: Multiple items (exact 3) ===');
    const keys = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      return [...gs.hiddenQuizCrates].slice(0, 2);
    });
    for (const k of keys) {
      const [r, c] = k.split(':').map(Number);
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r, c });
      await page.waitForTimeout(200);
    }
    state = await getGameState(page);
    assertCondition(state.quizItemsCount === 3, 'Test 4',
      `Expected exactly 3 items, got ${state.quizItemsCount}`, errors);

    // ===== TEST 5: P1 input isolation =====
    console.log('\n=== Test 5: P1 input isolation ===');
    const itemPos = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.quizItems && gs.quizItems.size > 0) {
        const first = [...gs.quizItems.values()][0];
        return { x: first.x, y: first.y, id: first.itemId };
      }
      return null;
    });
    if (!itemPos) {
      assertCondition(false, 'Test 5', 'No unclaimed item available for P1', errors);
    } else {
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.player1.setPosition(p.x, p.y);
      }, itemPos);
      await page.waitForTimeout(300);
      state = await getGameState(page);
      assertCondition(state.hasActiveSession && state.quizSceneActive, 'Test 5',
        'QuizScene active for P1', errors);

      const qs = await getQuizState(page);
      assertCondition(qs && qs.active && qs.playerId === 1, 'Test 5',
        `Quiz opened for P1, got playerId=${qs?.playerId}`, errors);

      // Try P2 keys - should NOT affect P1 quiz
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      const qsAfter = await getQuizState(page);
      assertCondition(qsAfter && !qsAfter.answered, 'Test 5',
        'P2 keys (ArrowDown + Enter) correctly ignored for P1', errors);

      // Answer with correct P1 key
      await answerQuizP1(page, qs.correctIndex);
      state = await getGameState(page);
      assertCondition(state.p1.jsCorrectCount === 1, 'Test 5',
        `P1 score should be 1, got ${state.p1.jsCorrectCount}`, errors);
    }

    // ===== TEST 6: P2 input isolation =====
    console.log('\n=== Test 6: P2 input isolation ===');
    let p2Item = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.quizItems && gs.quizItems.size > 0) {
        for (const item of gs.quizItems.values()) {
          if (!item.claimed && item.active) return { x: item.x, y: item.y };
        }
      }
      return null;
    });
    if (!p2Item) {
      const moreKeys = await page.evaluate(() => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        return [...gs.hiddenQuizCrates].slice(0, 3);
      });
      for (const k of moreKeys) {
        const [r, c] = k.split(':').map(Number);
        await page.evaluate((p) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
        }, { r, c });
        await page.waitForTimeout(200);
      }
      p2Item = await page.evaluate(() => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        if (gs.quizItems && gs.quizItems.size > 0) {
          for (const item of gs.quizItems.values()) {
            if (!item.claimed && item.active) return { x: item.x, y: item.y };
          }
        }
        return null;
      });
    }
    if (!p2Item) {
      assertCondition(false, 'Test 6', 'No unclaimed item for P2 after spawn attempts', errors);
    } else {
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.player2.setPosition(p.x, p.y);
      }, p2Item);
      await page.waitForTimeout(500);
      state = await getGameState(page);
      if (!state.quizSceneActive) {
        await page.waitForTimeout(2000);
        state = await getGameState(page);
      }
      assertCondition(state.quizSceneActive, 'Test 6', 'QuizScene active for P2', errors);

      const qs = await getQuizState(page);
      assertCondition(qs && qs.active && qs.playerId === 2, 'Test 6',
        `Quiz opened for P2, got playerId=${qs?.playerId}`, errors);

      // Try P1 keys - should NOT affect P2 quiz
      await page.keyboard.press('1');
      await page.waitForTimeout(100);
      await page.keyboard.press('2');
      await page.waitForTimeout(100);
      const qsAfter = await getQuizState(page);
      assertCondition(qsAfter && !qsAfter.answered, 'Test 6',
        'P1 keys (1,2,3,4) correctly ignored for P2', errors);

      // Verify ArrowDown changes p2SelectedIndex
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);
      const qsArrow = await getQuizState(page);
      assertCondition(qsArrow && qsArrow.p2SelectedIndex === 1, 'Test 6',
        `ArrowDown changed P2 selection to index ${qsArrow?.p2SelectedIndex}`, errors);

      // Reset selection and answer correctly
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(100);
      await answerQuizP2(page, qs.correctIndex);
      state = await getGameState(page);
      assertCondition(state.p2.jsCorrectCount >= 1, 'Test 6',
        `P2 score should be >= 1, got ${state.p2.jsCorrectCount}`, errors);
    }

    // ===== TEST 7: Same-item double claim STRICT =====
    console.log('\n=== Test 7: Same-item double claim STRICT ===');
    let doubleItem = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.quizItems && gs.quizItems.size > 0) {
        for (const item of gs.quizItems.values()) {
          if (!item.claimed && item.active) return { x: item.x, y: item.y };
        }
      }
      return null;
    });
    if (!doubleItem) {
      const spawnKeys = await page.evaluate(() => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        return [...gs.hiddenQuizCrates].slice(0, 2);
      });
      if (spawnKeys.length > 0) {
        const [r, c] = spawnKeys[0].split(':').map(Number);
        await page.evaluate((p) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
        }, { r, c });
        await page.waitForTimeout(500);
        doubleItem = await page.evaluate(() => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          if (gs.quizItems && gs.quizItems.size > 0) {
            for (const item of gs.quizItems.values()) {
              if (!item.claimed && item.active) return { x: item.x, y: item.y };
            }
          }
          return null;
        });
      }
    }
    if (!doubleItem) {
      assertCondition(false, 'Test 7', 'No item for double-claim test', errors);
    } else {
      state = await getGameState(page);
      const beforeP1 = state.p1.jsCorrectCount;
      const beforeP2 = state.p2.jsCorrectCount;
      const itemsBefore = state.quizItemsCount;

      // Position both players on the same item simultaneously
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.player1.setPosition(p.x, p.y);
        gs.player1.body.reset(p.x, p.y);
        gs.player2.setPosition(p.x, p.y);
        gs.player2.body.reset(p.x, p.y);
      }, doubleItem);
      await page.waitForTimeout(500);
      state = await getGameState(page);

      assertCondition(state.hasActiveSession, 'Test 7', 'Quiz session started from double claim', errors);

      const qs = await getQuizState(page);
      const claimingPlayer = qs?.playerId;
      if (claimingPlayer === 1) {
        await answerQuizP1(page, qs.correctIndex);
      } else if (claimingPlayer === 2) {
        await answerQuizP2(page, qs.correctIndex);
      } else {
        assertCondition(false, 'Test 7', `Unexpected playerId in quiz: ${claimingPlayer}`, errors);
      }

      state = await getGameState(page);
      const afterP1 = state.p1.jsCorrectCount;
      const afterP2 = state.p2.jsCorrectCount;
      const p1Delta = afterP1 - beforeP1;
      const p2Delta = afterP2 - beforeP2;
      const itemsAfter = state.quizItemsCount;

      assertCondition((p1Delta === 1 && p2Delta === 0) || (p1Delta === 0 && p2Delta === 1), 'Test 7',
        `Exactly one player score increased: p1Delta=${p1Delta}, p2Delta=${p2Delta}`, errors);
      assertCondition(itemsAfter === itemsBefore - 1, 'Test 7',
        `Item should be consumed exactly once (was ${itemsBefore}, now ${itemsAfter})`, errors);
    }

    // ===== TEST 8: Two-item race STRICT (deterministic handler calls) =====
    console.log('\n=== Test 8: Two-item race STRICT ===');
    await restartGame(page);
    state = await getGameState(page);
    const twoKeys = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      return [...gs.hiddenQuizCrates].slice(0, 2);
    });
    if (twoKeys.length < 2) {
      assertCondition(false, 'Test 8', 'Not enough hidden crates (need 2)', errors);
    } else {
      for (const k of twoKeys) {
        const [r, c] = k.split(':').map(Number);
        await page.evaluate((p) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
        }, { r, c });
        await page.waitForTimeout(200);
      }
      state = await getGameState(page);
      assertCondition(state.quizItemsCount === 2, 'Test 8',
        `Expected 2 items for race test, got ${state.quizItemsCount}`, errors);

      // Use deterministic handler calls instead of physics teleport
      const raceResult = await page.evaluate(() => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        const items = [...gs.quizItems.values()];
        if (items.length < 2) return { error: 'Not enough items' };

        const itemA = items[0];
        const itemB = items[1];
        const p1 = gs.player1;
        const p2 = gs.player2;

        // Call handler for P1 on item A, then immediately for P2 on item B
        gs.handleQuizItemOverlap(p1, itemA);
        const midSession = gs.activeQuizSession ? {
          itemId: gs.activeQuizSession.itemId, playerId: gs.activeQuizSession.playerId
        } : null;

        gs.handleQuizItemOverlap(p2, itemB);
        const postSession = gs.activeQuizSession ? {
          itemId: gs.activeQuizSession.itemId, playerId: gs.activeQuizSession.playerId
        } : null;

        return {
          midSession, postSession,
          itemA: { itemId: itemA.itemId, claimed: itemA.claimed, collected: itemA.collected, active: itemA.active },
          itemB: { itemId: itemB.itemId, claimed: itemB.claimed, collected: itemB.collected, active: itemB.active }
        };
      });

      if (raceResult.error) {
        assertCondition(false, 'Test 8', raceResult.error, errors);
      } else {
        const claimedCount = (raceResult.itemA.claimed ? 1 : 0) + (raceResult.itemB.claimed ? 1 : 0);
        assertCondition(claimedCount === 1, 'Test 8',
          `Exactly one item should be claimed, got ${claimedCount}`, errors);
        assertCondition(!!raceResult.midSession, 'Test 8',
          'Active quiz session should exist after first claim', errors);

        const unclaimedItem = raceResult.itemA.claimed ? raceResult.itemB : raceResult.itemA;
        assertCondition(!unclaimedItem.claimed, 'Test 8',
          `Unclaimed item should have claimed=false (item ${unclaimedItem.itemId})`, errors);
        assertCondition(unclaimedItem.active, 'Test 8',
          `Unclaimed item should be active (item ${unclaimedItem.itemId})`, errors);
      }

      // Wait for QuizScene to become active
      const quizActive = await page.waitForFunction(() => {
        return window.__BUBBLE_BATTLE_GAME__.scene.isActive('QuizScene');
      }, { timeout: 2000 }).catch(() => false);
      assertCondition(!!quizActive, 'Test 8', 'QuizScene should be active after claim', errors);

      // Complete the first quiz
      const qs = await getQuizState(page);
      if (qs) {
        if (qs.playerId === 1) {
          await page.keyboard.press(String(qs.correctIndex + 1));
        } else {
          for (let i = 0; i < qs.correctIndex; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(50); }
          await page.keyboard.press('Enter');
        }
        // Wait for quiz to close
        await page.waitForFunction(() => {
          return !window.__BUBBLE_BATTLE_GAME__.scene.isActive('QuizScene');
        }, { timeout: 5000 }).catch(() => {});
      }

      // Wait for quiz to close and GameScene to resume
      await page.waitForFunction(() => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        return !window.__BUBBLE_BATTLE_GAME__.scene.isActive('QuizScene')
          && gs && !gs.activeQuizSession
          && gs.roundManager?.state === 'playing';
      }, { timeout: 5000 }).catch(() => {});

      // Verify unclaimed item still exists with correct state
      const remainingCheck = await page.evaluate(() => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        const items = [...(gs.quizItems?.values() || [])].map(it => ({
          itemId: it.itemId, claimed: it.claimed, collected: it.collected, active: it.active,
          bodyEnabled: it.body?.enable ?? null, hasLifetime: !!it.lifetimeTimer
        }));
        const unclaimed = items.filter(it => !it.claimed && it.active);
        return { items, unclaimedCount: unclaimed.length, drain: gs._postQuizDrain };
      });

      assertCondition(remainingCheck.unclaimedCount === 1, 'Test 8',
        `Expected 1 unclaimed item after quiz, got ${remainingCheck.unclaimedCount}`, errors);
      if (remainingCheck.unclaimedCount >= 1) {
        const r = remainingCheck.items.find(it => !it.claimed && it.active);
        assertCondition(r.bodyEnabled === true, 'Test 8', 'Unclaimed item body should be enabled', errors);
        assertCondition(r.hasLifetime === true, 'Test 8', 'Unclaimed item should have lifetime timer', errors);

        // Attempt to claim the remaining item
        await page.evaluate(({ itemId }) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          const item = [...gs.quizItems.values()].find(it => it.itemId === itemId);
          if (item) gs.handleQuizItemOverlap(gs.player1, item);
        }, r);

        const secondQuiz = await page.waitForFunction(() => {
          return window.__BUBBLE_BATTLE_GAME__.scene.isActive('QuizScene');
        }, { timeout: 2000 }).catch(() => false);
        assertCondition(!!secondQuiz, 'Test 8', 'Second quiz should open for remaining item', errors);
      }
    }

    // ===== TEST 9: Opponent steal =====
    console.log('\n=== Test 9: Opponent steal ===');
    await restartGame(page);
    state = await getGameState(page);
    const stealKey = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.hiddenQuizCrates.size > 0) return [...gs.hiddenQuizCrates][0];
      return null;
    });
    if (!stealKey) {
      assertCondition(false, 'Test 9', 'No hidden crate for steal test', errors);
    } else {
      const [sr, sc] = stealKey.split(':').map(Number);
      // P1 destroys the crate, but P2 claims the item
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.player1.setPosition(p.r * 48 + 24, p.c * 48 + 24);
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: sr, c: sc });
      await page.waitForTimeout(300);
      const stealItem = await page.evaluate(() => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        if (gs.quizItems && gs.quizItems.size > 0) {
          const first = [...gs.quizItems.values()][0];
          return { x: first.x, y: first.y };
        }
        return null;
      });
      if (!stealItem) {
        assertCondition(false, 'Test 9', 'No item spawned for steal test', errors);
      } else {
        await page.evaluate((p) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.player2.setPosition(p.x, p.y);
        }, stealItem);
        await page.waitForTimeout(500);
        const qs = await getQuizState(page);
        assertCondition(qs && qs.playerId === 2, 'Test 9',
          `Quiz should be for P2 (stealer), got playerId=${qs?.playerId}`, errors);

        await answerQuizP2(page, qs.correctIndex);
        state = await getGameState(page);
        assertCondition(state.p2.jsCorrectCount >= 1, 'Test 9',
          `P2 score should increase after steal, got ${state.p2.jsCorrectCount}`, errors);
      }
    }

    // ===== TEST 10: Wrong answer =====
    console.log('\n=== Test 10: Wrong answer ===');
    await restartGame(page);
    const wrongKey = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.hiddenQuizCrates.size > 0) return [...gs.hiddenQuizCrates][0];
      return null;
    });
    if (!wrongKey) {
      assertCondition(false, 'Test 10', 'No hidden crate for wrong answer test', errors);
    } else {
      const [wr, wc] = wrongKey.split(':').map(Number);
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: wr, c: wc });
      await page.waitForTimeout(300);
      const wrongItem = await page.evaluate(() => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        if (gs.quizItems && gs.quizItems.size > 0) {
          const first = [...gs.quizItems.values()][0];
          return { x: first.x, y: first.y };
        }
        return null;
      });
      if (!wrongItem) {
        assertCondition(false, 'Test 10', 'No item spawned', errors);
      } else {
        await page.evaluate((p) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.player1.setPosition(p.x, p.y);
        }, wrongItem);
        await page.waitForTimeout(300);
        const qs = await getQuizState(page);
        if (!qs) {
          assertCondition(false, 'Test 10', 'Quiz did not open', errors);
        } else {
          const preScore = (await getGameState(page)).p1.jsCorrectCount;
          const wrongIdx = (qs.correctIndex + 1) % 4;
          await page.keyboard.press(String(wrongIdx + 1));
          await page.waitForTimeout(2500);
          state = await getGameState(page);
          assertCondition(state.p1.jsCorrectCount === preScore, 'Test 10',
            `Score should be unchanged after wrong answer (was ${preScore}, now ${state.p1.jsCorrectCount})`, errors);
          assertCondition(!state.quizSceneActive, 'Test 10', 'QuizScene should be closed after wrong answer', errors);
        }
      }
    }

    // ===== TEST 11: Timeout =====
    console.log('\n=== Test 11: Timeout ===');
    await restartGame(page);
    const tKey = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.hiddenQuizCrates.size > 0) return [...gs.hiddenQuizCrates][0];
      return null;
    });
    if (!tKey) {
      assertCondition(false, 'Test 11', 'No hidden crate for timeout test', errors);
    } else {
      const [tr, tc] = tKey.split(':').map(Number);
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: tr, c: tc });
      await page.waitForTimeout(300);
      const tItem = await page.evaluate(() => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        if (gs.quizItems && gs.quizItems.size > 0) {
          const first = [...gs.quizItems.values()][0];
          return { x: first.x, y: first.y };
        }
        return null;
      });
      if (!tItem) {
        assertCondition(false, 'Test 11', 'No item spawned', errors);
      } else {
        await page.evaluate((p) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.player1.setPosition(p.x, p.y);
        }, tItem);
        await page.waitForTimeout(300);
        const preScore = (await getGameState(page)).p1.jsCorrectCount;
        await page.waitForTimeout(12000);
        state = await getGameState(page);
        assertCondition(state.p1.jsCorrectCount === preScore, 'Test 11',
          `Score should be unchanged after timeout (was ${preScore}, now ${state.p1.jsCorrectCount})`, errors);
        assertCondition(!state.quizSceneActive, 'Test 11', 'QuizScene should be closed after timeout', errors);
      }
    }

    // ===== TEST 12: Item lifetime =====
    console.log('\n=== Test 12: Item lifetime ===');
    await restartGame(page);
    const ltKey = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.hiddenQuizCrates.size > 0) return [...gs.hiddenQuizCrates][0];
      return null;
    });
    if (!ltKey) {
      assertCondition(false, 'Test 12', 'No hidden crate', errors);
    } else {
      const [lr, lc] = ltKey.split(':').map(Number);
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: lr, c: lc });
      await page.waitForTimeout(300);
      state = await getGameState(page);
      assertCondition(state.quizItemsCount === 1, 'Test 12',
        `Expected 1 item for lifetime test, got ${state.quizItemsCount}`, errors);
      await page.waitForTimeout(22000);
      state = await getGameState(page);
      assertCondition(state.quizItemsCount === 0, 'Test 12',
        `Item should have despawned after lifetime, got ${state.quizItemsCount} items`, errors);
    }

    // ===== TEST 13: Lifetime pause during quiz STRICT =====
    console.log('\n=== Test 13: Lifetime pause during quiz STRICT ===');
    await restartGame(page);
    const pauseKeys = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      return [...gs.hiddenQuizCrates];
    });
    if (pauseKeys.length < 2) {
      assertCondition(false, 'Test 13', 'Not enough hidden crates (need 2)', errors);
    } else {
      const [r1, c1] = pauseKeys[0].split(':').map(Number);
      const [r2, c2] = pauseKeys[1].split(':').map(Number);

      // Spawn item A
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: r1, c: c1 });
      await page.waitForTimeout(300);

      // Spawn item B
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: r2, c: c2 });
      await page.waitForTimeout(200);

      state = await getGameState(page);
      assertCondition(state.quizItemsCount === 2, 'Test 13',
        `Expected 2 items, got ${state.quizItemsCount}`, errors);

      // Get items and find item B's remaining lifetime
      const items13 = await getItemDetails(page);
      const itemA13 = items13[0];
      const itemB13 = items13[1];

      const remainingBefore = await page.evaluate((itemId) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        for (const item of gs.quizItems.values()) {
          if (item.itemId === itemId && item.lifetimeTimer) {
            try {
              if (typeof item.lifetimeTimer.getRemaining === 'function') {
                return item.lifetimeTimer.getRemaining();
              }
              return item.lifetimeTimer.delay - item.lifetimeTimer.elapsed;
            } catch (e) { return null; }
          }
        }
        return null;
      }, itemB13.itemId);

      // Position P1 on item A to open quiz (pauses GameScene)
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.player1.setPosition(p.x, p.y);
      }, itemA13);
      await page.waitForTimeout(300);
      const qs13 = await getQuizState(page);
      assertCondition(!!qs13, 'Test 13', 'Quiz did not open for lifetime pause test', errors);

      // Wait 3s wall-clock while GameScene is paused
      await page.waitForTimeout(3000);

      const remainingDuring = await page.evaluate((itemId) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        for (const item of gs.quizItems.values()) {
          if (item.itemId === itemId && item.lifetimeTimer) {
            try {
              if (typeof item.lifetimeTimer.getRemaining === 'function') {
                return item.lifetimeTimer.getRemaining();
              }
              return item.lifetimeTimer.delay - item.lifetimeTimer.elapsed;
            } catch (e) { return null; }
          }
        }
        return null;
      }, itemB13.itemId);

      const timerReadable = remainingBefore !== null && remainingDuring !== null;
      assertCondition(timerReadable, 'Test 13',
        `Lifetime timer readable: before=${remainingBefore}, during=${remainingDuring}`, errors);

      if (timerReadable) {
        assertCondition(Math.abs(remainingBefore - remainingDuring) < 500, 'Test 13',
          `Lifetime timer changed while paused: before=${remainingBefore}, during=${remainingDuring}, diff=${Math.abs(remainingBefore - remainingDuring)}`, errors);
      }

      // Answer quiz immediately (don't wait for timeout)
      if (qs13.playerId === 1) {
        await answerQuizP1(page, qs13.correctIndex);
      } else {
        await answerQuizP2(page, qs13.correctIndex);
      }
      await page.waitForTimeout(1000);

      state = await getGameState(page);
      assertCondition(state.quizItemsCount >= 1, 'Test 13',
        `Item B should still exist after quiz closed (${state.quizItemsCount} items)`, errors);
    }

    // ===== TEST 14: Power-up caps STRICT =====
    console.log('\n=== Test 14: Power-up caps STRICT ===');
    await restartGame(page);
    state = await getGameState(page);

    await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      const p1 = gs.player1;
      for (let i = 0; i < 6; i++) {
        p1.increaseMaxBalloons();
        p1.increaseExplosionRange();
      }
      // Reflect caps in HUD
      gs.updatePlayerPowerUpHUD(1);
    });

    state = await getGameState(page);
    assertCondition(state.p1.maxBalloons === 5, 'Test 14',
      `maxBalloons should be exactly 5 after 6 increases, got ${state.p1.maxBalloons}`, errors);
    assertCondition(state.p1.waterRange === 5, 'Test 14',
      `waterRange should be exactly 5 after 6 increases, got ${state.p1.waterRange}`, errors);

    // Call increase 3 more times — should stay at 5
    await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      const p1 = gs.player1;
      for (let i = 0; i < 3; i++) {
        p1.increaseMaxBalloons();
        p1.increaseExplosionRange();
      }
    });

    state = await getGameState(page);
    assertCondition(state.p1.maxBalloons === 5, 'Test 14',
      `maxBalloons should STILL be exactly 5 after 3 more increases, got ${state.p1.maxBalloons}`, errors);
    assertCondition(state.p1.waterRange === 5, 'Test 14',
      `waterRange should STILL be exactly 5 after 3 more increases, got ${state.p1.waterRange}`, errors);

    // Assert exact HUD text after reflecting caps
    const hudExact = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (!gs) return { balloon: null, range: null };
      return {
        balloon: gs.p1BalloonHud?.text || null,
        range: gs.p1RangeHud?.text || null
      };
    });
    assertCondition(hudExact.balloon === 'BALLOON: 5/5', 'Test 14',
      `HUD balloon should be "BALLOON: 5/5", got "${hudExact.balloon}"`, errors);
    assertCondition(hudExact.range === 'RANGE: 5/5', 'Test 14',
      `HUD range should be "RANGE: 5/5", got "${hudExact.range}"`, errors);

    // ===== TEST 15: Speed duration STRICT =====
    console.log('\n=== Test 15: Speed duration STRICT ===');
    await restartGame(page);
    state = await getGameState(page);

    await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      gs.player1.applySpeedBoost();
    });
    state = await getGameState(page);
    assertCondition(state.p1.speedBoostActive, 'Test 15', 'Speed boost should be active', errors);

    const remaining1 = await page.evaluate(() => {
      const p1 = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene').player1;
      return p1.getSpeedBoostRemaining ? p1.getSpeedBoostRemaining() : null;
    });
    assertCondition(remaining1 !== null && remaining1 >= 14 && remaining1 <= 15, 'Test 15',
      `Initial speed boost remaining should be 14-15s, got ${remaining1}`, errors);

    // Wait 500ms and re-apply — should refresh
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      gs.player1.applySpeedBoost();
    });
    const remaining2 = await page.evaluate(() => {
      const p1 = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene').player1;
      return p1.getSpeedBoostRemaining ? p1.getSpeedBoostRemaining() : null;
    });
    assertCondition(remaining2 !== null && remaining2 >= 14 && remaining2 <= 15, 'Test 15',
      `Speed boost should refresh to 14-15s, got ${remaining2}`, errors);

    // Check speed is not stacked
    const actualSpeed = await page.evaluate(() => {
      return window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene').player1.speed;
    });
    assertCondition(Math.abs(actualSpeed - 180) <= 1, 'Test 15',
      `Speed should be ~180 (no stack), got ${actualSpeed}`, errors);

    // --- Speed pause test ---
    // Apply fresh speed boost
    await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      gs.player1.applySpeedBoost();
    });
    const remainingBefore = await page.evaluate(() => {
      const p1 = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene').player1;
      return p1.getSpeedBoostRemaining ? p1.getSpeedBoostRemaining() : null;
    });

    // Spawn item and open quiz
    const spdKeys = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      return [...gs.hiddenQuizCrates].slice(0, 1);
    });
    if (spdKeys.length > 0) {
      const [sr, sc] = spdKeys[0].split(':').map(Number);
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: sr, c: sc });
      await page.waitForTimeout(300);
      const spdItem = await page.evaluate(() => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        if (gs.quizItems && gs.quizItems.size > 0) {
          const first = [...gs.quizItems.values()][0];
          return { x: first.x, y: first.y };
        }
        return null;
      });
      if (spdItem) {
        await page.evaluate((p) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.player1.setPosition(p.x, p.y);
        }, spdItem);
        await page.waitForTimeout(300);
        // Quiz open — GameScene paused — wait 3s
        await page.waitForTimeout(3000);
        const remainingDuring = await page.evaluate(() => {
          const p1 = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene').player1;
          return p1.getSpeedBoostRemaining ? p1.getSpeedBoostRemaining() : null;
        });
        if (remainingBefore !== null && remainingDuring !== null) {
          assertCondition(Math.abs(remainingBefore - remainingDuring) <= 1, 'Test 15',
            `Speed boost should pause during quiz (before=${remainingBefore}, during=${remainingDuring})`, errors);
        }
        // Close quiz
        const qs15 = await getQuizState(page);
        if (qs15) {
          if (qs15.playerId === 1) {
            await answerQuizP1(page, qs15.correctIndex);
          } else {
            await answerQuizP2(page, qs15.correctIndex);
          }
        }
        await page.waitForTimeout(1000);
        const remainingAfter = await page.evaluate(() => {
          const p1 = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene').player1;
          return p1.getSpeedBoostRemaining ? p1.getSpeedBoostRemaining() : null;
        });
        if (remainingDuring !== null && remainingAfter !== null) {
          assertCondition(remainingAfter < remainingDuring - 0.5, 'Test 15',
            `Speed boost should resume after quiz close (during=${remainingDuring}, after=${remainingAfter})`, errors);
        }
      }
    }

    // ===== TEST 16: Range snapshot EXACT =====
    console.log('\n=== Test 16: Range snapshot EXACT ===');
    await restartGame(page);
    let rangeA = null;
    await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      const p1 = gs.player1;
      p1.waterRange = 1;
      p1.setPosition(48 * 3 + 24, 48 * 3 + 24);
      p1.body.reset(48 * 3 + 24, 48 * 3 + 24);
      gs.events.emit('request_place_balloon', p1);
    });
    await page.waitForTimeout(300);
    rangeA = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      const balloons = gs.balloons.getChildren();
      return balloons.length > 0 ? balloons[0].range : null;
    });

    // Make balloon A explode to free the slot
    await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      const balloons = gs.balloons.getChildren();
      if (balloons.length > 0) {
        const b = balloons[balloons.length - 1];
        if (b.fuseTimer) { b.fuseTimer.remove(false); b.fuseTimer = null; }
        b.explode();
      }
    });
    await page.waitForTimeout(500);

    // Call increaseExplosionRange() ONE time (not two)
    await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      gs.player1.increaseExplosionRange();
      gs.player1.setPosition(48 * 5 + 24, 48 * 5 + 24);
      gs.player1.body.reset(48 * 5 + 24, 48 * 5 + 24);
      gs.events.emit('request_place_balloon', gs.player1);
    });
    await page.waitForTimeout(300);
    const rangeB = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      const balloons = gs.balloons.getChildren();
      return balloons.length > 0 ? balloons[balloons.length - 1].range : null;
    });

    assertCondition(rangeA === 1, 'Test 16',
      `Balloon A range should be 1 (snapshotted), got ${rangeA}`, errors);
    assertCondition(rangeB === 2, 'Test 16',
      `Balloon B range should be 2 (after one increase from 1), got ${rangeB}`, errors);

    // ===== TEST 17: UI bounds STRICT (10 questions × 2 players) =====
    console.log('\n=== Test 17: UI bounds STRICT ===');
    await restartGame(page);

    const questions = JS_QUESTIONS;
    assertCondition(
      questions.length === 10,
      'Test 17',
      `Expected 10 questions, got ${questions.length}`,
      errors
    );

    let anyFail = false;
    const questionCount = questions.length;
    const PANEL_X = 400, PANEL_Y = 300, PANEL_W = 760, PANEL_H = 560;
    const panelL = PANEL_X - PANEL_W / 2, panelR = PANEL_X + PANEL_W / 2;
    const panelT = PANEL_Y - PANEL_H / 2, panelB = PANEL_Y + PANEL_H / 2;

    for (const playerId of [1, 2]) {
      console.log(`  Checking UI bounds for P${playerId} across ${questionCount} questions...`);

      for (let qi = 0; qi < questionCount; qi++) {
        const q = questions[qi];

        await page.evaluate(() => {
          const game = window.__BUBBLE_BATTLE_GAME__;
          if (game.scene.isActive('QuizScene')) game.scene.stop('QuizScene');
          const gs = game.scene.getScene('GameScene');
          if (gs && gs.scene.isPaused()) gs.scene.resume();
        });
        await page.waitForTimeout(150);

        await page.evaluate(({ question, pid }) => {
          const game = window.__BUBBLE_BATTLE_GAME__;
          if (!game) return;
          if (game.scene.isActive('QuizScene')) game.scene.stop('QuizScene');
          const gs = game.scene.getScene('GameScene');
          if (gs && gs.scene.isPaused()) gs.scene.resume();
          gs.scene.launch('QuizScene', { question, playerId: pid });
        }, { question: q, pid: playerId });

        const active = await page.waitForFunction(() => {
          return window.__BUBBLE_BATTLE_GAME__.scene.isActive('QuizScene');
        }, { timeout: 2000 }).catch(() => false);
        if (!active) {
          anyFail = true;
          console.log(`  VIOLATION ${q.id} P${playerId}: QuizScene did not activate`);
          continue;
        }

        const uiResult = await page.evaluate(({ qid, pid }) => {
          const qs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('QuizScene');
          if (!qs || !qs.scene.isActive()) return { error: 'not active' };
          const children = qs.children.list;
          const v = [];
          const pL = 20, pR = 780, pT = 20, pB = 580;
          const boxL = 100, boxR = 700, boxW = 600;

          let panel = null;
          const boxes = [];
          const aTexts = [];
          const prefixObjs = [];

          for (const c of children) {
            if (!c || !c.getBounds) continue;
            const b = c.getBounds();
            if (b.width < 1 && b.height < 1) continue;

            if (b.x < 0 || b.y < 0 || b.right > 800 || b.bottom > 600) {
              v.push(`canvas overflow: ${c.type} (${Math.round(b.x)},${Math.round(b.y)})-(${Math.round(b.right)},${Math.round(b.bottom)})`);
            }

            if (c.type === 'Rectangle') {
              if (b.width >= 700 && b.height >= 500) panel = b;
              else if (b.width >= 500 && b.height >= 40 && b.height <= 120) boxes.push(b);
            }
            if (c.type === 'Text') {
              const t = c.text || '';
              if (t.includes('Quiz') || t.includes('Nhan') || t.includes('Dung') || t.includes('ENTER') || t.includes('xac nhan')) continue;
              if (/^\d+s$/.test(t)) continue;
              if (t === '>' && pid === 2) prefixObjs.push(b);
              else if (/^[\d ]$/.test(t) || /^\d$/.test(t)) prefixObjs.push(b);
              else if (/^[ABCD]\./.test(t)) aTexts.push(b);
            }
          }

          boxes.sort((a, b) => a.y - b.y);
          aTexts.sort((a, b) => a.y - b.y);

          if (panel) {
            for (const bx of boxes) {
              if (bx.x < boxL - 3 || bx.right > boxR + 3) v.push(`answerBox outside panel horizontally`);
              if (bx.y < pT - 3 || bx.bottom > pB + 3) v.push(`answerBox outside panel vertically`);
            }
            for (let i = 1; i < boxes.length; i++) {
              if (boxes[i - 1].bottom > boxes[i].y + 3) v.push(`answerBox${i - 1} overlaps answerBox${i}`);
            }
            for (let i = 0; i < aTexts.length && i < boxes.length; i++) {
              if (aTexts[i].x < boxL - 5 || aTexts[i].right > boxR + 5) v.push(`answerText${i} outside answerBox${i}`);
            }
            for (let i = 0; i < prefixObjs.length && i < boxes.length; i++) {
              if (prefixObjs[i].x < boxL - 2 || prefixObjs[i].right > boxL + 60) v.push(`prefix${i} outside answer box left`);
            }
          }

          return { violations: v, qid };
        }, { qid: q.id, pid: playerId });

        if (uiResult.error) {
          anyFail = true;
          console.log(`  VIOLATION ${q.id} P${playerId}: ${uiResult.error}`);
        }
        if (uiResult.violations && uiResult.violations.length > 0) {
          anyFail = true;
          for (const vv of uiResult.violations) {
            console.log(`  VIOLATION ${q.id} P${playerId}: ${vv}`);
          }
        }

        await page.evaluate(() => {
          if (window.__BUBBLE_BATTLE_GAME__.scene.isActive('QuizScene'))
            window.__BUBBLE_BATTLE_GAME__.scene.stop('QuizScene');
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          if (gs && gs.scene.isPaused()) gs.scene.resume();
        });
        await page.waitForTimeout(150);
      }
    }

    assertCondition(!anyFail, 'Test 17',
      'No UI bounds violations across 20 question layouts', errors);

    // ===== TEST 18: Restart lifecycle STRICT (7 listeners) =====
    console.log('\n=== Test 18: Restart lifecycle (3x) ===');
    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`  Restart cycle ${cycle}...`);
      await page.evaluate(() => {
        const game = window.__BUBBLE_BATTLE_GAME__;
        game.scene.start('ResultScene', { result: 'draw', reason: 'test', duration: 0, p1JsCorrect: 0, p2JsCorrect: 0 });
      });
      await page.waitForTimeout(800);
      await page.keyboard.press('Space');
      await page.waitForTimeout(1500);
    }
    state = await getGameState(page);

    assertCondition(state.hiddenQuizCratesSize === 10, 'Test 18',
      `hiddenQuizCratesSize should be 10, got ${state.hiddenQuizCratesSize}`, errors);
    assertCondition(state.quizItemsCount === 0, 'Test 18',
      `quizItemsCount should be 0, got ${state.quizItemsCount}`, errors);
    assertCondition(state.revealedQuizCount === 0, 'Test 18',
      `revealedQuizCount should be 0, got ${state.revealedQuizCount}`, errors);
    assertCondition(!state.hasActiveSession, 'Test 18',
      'hasActiveSession should be false', errors);
    assertCondition(state.listeners.crate_destroyed === 1, 'Test 18',
      `crate_destroyed listeners should be 1, got ${state.listeners.crate_destroyed}`, errors);
    assertCondition(state.listeners.quiz_answered === 1, 'Test 18',
      `quiz_answered listeners should be 1, got ${state.listeners.quiz_answered}`, errors);
    assertCondition(state.listeners.quiz_item_despawned === 1, 'Test 18',
      `quiz_item_despawned listeners should be 1, got ${state.listeners.quiz_item_despawned}`, errors);
    assertCondition(state.listeners.power_up_granted === 1, 'Test 18',
      `power_up_granted listeners should be 1, got ${state.listeners.power_up_granted}`, errors);
    assertCondition(state.listeners.speed_boost_ended === 1, 'Test 18',
      `speed_boost_ended listeners should be 1, got ${state.listeners.speed_boost_ended}`, errors);
    assertCondition(state.listeners.timer_tick === 1, 'Test 18',
      `timer_tick listeners should be 1, got ${state.listeners.timer_tick}`, errors);
    assertCondition(state.listeners.request_place_balloon === 1, 'Test 18',
      `request_place_balloon listeners should be 1, got ${state.listeners.request_place_balloon}`, errors);

    // ===== Summary =====
    console.log('\n========================================');
    if (consoleErrors.length > 0) {
      console.log('CONSOLE ERRORS DETECTED:');
      consoleErrors.forEach(e => console.log(`  ${e}`));
    }
    const TEST_CASE_COUNT = 18;
    if (errors.length === 0 && consoleErrors.length === 0 && passedTests === executedTests) {
      console.log(
        `ALL QUIZ BROWSER ASSERTIONS PASSED ` +
        `(${passedTests}/${executedTests} assertions across ${TEST_CASE_COUNT} test cases).`
      );
    } else {
      console.log(
        `QUIZ BROWSER TESTS FAILED: ` +
        `${passedTests}/${executedTests} assertions passed across ` +
        `${TEST_CASE_COUNT} test cases, ` +
        `${errors.length} error(s), ` +
        `${consoleErrors.length} console error(s)`
      );
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
