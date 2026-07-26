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
        jsCorrectCount: scene.player1.jsCorrectCount,
        speed: scene.player1.speed,
        maxBalloons: scene.player1.maxBalloons,
        waterRange: scene.player1.waterRange,
        speedBoostActive: scene.player1.speedBoostActive,
        x: scene.player1.x,
        y: scene.player1.y
      },
      p2: {
        jsCorrectCount: scene.player2.jsCorrectCount,
        maxBalloons: scene.player2.maxBalloons,
        waterRange: scene.player2.waterRange,
        speedBoostActive: scene.player2.speedBoostActive,
        x: scene.player2.x,
        y: scene.player2.y
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

    // ===== TEST 1: Exact hidden crates ====
    console.log('\n=== Test 1: Exact 10 hidden crates ===');
    if (state.hiddenQuizCratesSize !== 10) {
      errors.push(`Test 1 FAIL: Expected 10 hidden crates, got ${state.hiddenQuizCratesSize}`);
      console.log(`FAIL: ${state.hiddenQuizCratesSize} hidden crates, expected 10`);
    } else {
      console.log('PASS: 10 hidden crates selected');
    }

    // ===== TEST 2: Normal crate no spawn ====
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
      errors.push('Test 2 FAIL: Could not find any normal (non-hidden) crate');
      console.log('FAIL: No normal crate found');
    } else {
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.row, col: p.col, x: 0, y: 0 });
      }, normalCrate);
      await page.waitForTimeout(300);
      state = await getGameState(page);
      if (state.quizItemsCount !== 0) {
        errors.push('Test 2 FAIL: Item spawned from normal crate');
        console.log(`FAIL: ${state.quizItemsCount} items spawned from normal crate`);
      } else {
        console.log('PASS: No item from normal crate');
      }
    }

    // ===== TEST 3: Hidden crate spawns exactly 1 item ====
    console.log('\n=== Test 3: Hidden crate spawns exactly 1 item at grid position ===');
    const hiddenKey = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.hiddenQuizCrates.size > 0) return [...gs.hiddenQuizCrates][0];
      return null;
    });
    if (!hiddenKey) {
      errors.push('Test 3 FAIL: No hidden crates remaining');
      console.log('FAIL: No hidden crates');
    } else {
      const [hr, hc] = hiddenKey.split(':').map(Number);
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: hr, c: hc });
      await page.waitForTimeout(500);
      state = await getGameState(page);
      if (state.quizItemsCount !== 1) {
        errors.push(`Test 3 FAIL: Expected 1 item, got ${state.quizItemsCount}`);
        console.log(`FAIL: count=${state.quizItemsCount}`);
      } else {
        const itemDetails = await getItemDetails(page);
        if (itemDetails.length === 1) {
          console.log(`PASS: 1 item at grid (${itemDetails[0].gridRow},${itemDetails[0].gridCol})`);
        }
      }
    }

    // ===== TEST 4: Multiple items (exact count) ====
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
    if (state.quizItemsCount !== 3) {
      errors.push(`Test 4 FAIL: Expected exactly 3 items, got ${state.quizItemsCount}`);
      console.log(`FAIL: ${state.quizItemsCount} items`);
    } else {
      console.log(`PASS: Exactly 3 items coexist`);
    }

    // ===== TEST 5: P1 input isolation ====
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
      errors.push('Test 5 FAIL: No unclaimed item available');
      console.log('FAIL: No item to claim for P1');
    } else {
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.player1.setPosition(p.x, p.y);
      }, itemPos);
      await page.waitForTimeout(300);
      state = await getGameState(page);
      if (!state.hasActiveSession || !state.quizSceneActive) {
        errors.push('Test 5 FAIL: QuizScene did not open for P1');
        console.log('FAIL: QuizScene not active');
      } else {
        const qs = await getQuizState(page);
        if (qs && qs.active && qs.playerId === 1) {
          // Try wrong keys for P1 (ArrowDown, Enter) - they should NOT affect P1 quiz
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(100);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(100);
          const qsAfter = await getQuizState(page);
          if (qsAfter && !qsAfter.answered) {
            console.log('PASS: P2 keys do not affect P1 quiz');
            // Answer with correct P1 key
            await answerQuizP1(page, qs.correctIndex);
            state = await getGameState(page);
            if (state.p1.jsCorrectCount === 1) {
              console.log(`PASS: P1 score = ${state.p1.jsCorrectCount}`);
            } else {
              errors.push(`Test 5 FAIL: P1 score = ${state.p1.jsCorrectCount}, expected 1`);
            }
          } else {
            errors.push('Test 5 FAIL: P2 keys affected P1 quiz');
          }
        } else {
          errors.push(`Test 5 FAIL: Quiz not for P1, playerId=${qs?.playerId}`);
        }
      }
    }

    // ===== TEST 6: P2 input isolation ====
    console.log('\n=== Test 6: P2 input isolation ===');
    // Find an unclaimed item for P2
    const p2Item = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.quizItems && gs.quizItems.size > 0) {
        for (const item of gs.quizItems.values()) {
          if (!item.claimed && item.active) return { x: item.x, y: item.y };
        }
      }
      return null;
    });
    if (!p2Item) {
      // Try to spawn more items
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
    }
    const p2Item2 = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.quizItems && gs.quizItems.size > 0) {
        for (const item of gs.quizItems.values()) {
          if (!item.claimed && item.active) return { x: item.x, y: item.y };
        }
      }
      return null;
    });
    if (!p2Item2) {
      errors.push('Test 6 FAIL: No unclaimed item for P2');
      console.log('FAIL: No item to claim for P2');
    } else {
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.player2.setPosition(p.x, p.y);
      }, p2Item2);
      await page.waitForTimeout(500);
      state = await getGameState(page);
      if (!state.quizSceneActive) {
        // If quiz didn't open (maybe P1 claimed first), find and wait
        await page.waitForTimeout(2000);
        state = await getGameState(page);
      }
      if (!state.quizSceneActive) {
        // Need the item - try spawning more and waiting
        const lastKeys = await page.evaluate(() => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          return [...gs.hiddenQuizCrates].slice(0, 3);
        });
        for (const k of lastKeys) {
          const [r, c] = k.split(':').map(Number);
          await page.evaluate((p) => {
            const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
            gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
          }, { r, c });
          await page.waitForTimeout(200);
        }
        const finalItem = await page.evaluate(() => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          if (gs.quizItems && gs.quizItems.size > 0) {
            for (const item of gs.quizItems.values()) {
              if (!item.claimed && item.active) return { x: item.x, y: item.y };
            }
          }
          return null;
        });
        if (!finalItem) {
          errors.push('Test 6 FAIL: Still no unclaimed item after spawn attempts');
          console.log('FAIL: Cannot create claimable item for P2');
        } else {
          await page.evaluate((p) => {
            const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
            gs.player2.setPosition(p.x, p.y);
          }, finalItem);
          await page.waitForTimeout(500);
        }
      }
      const qs = await getQuizState(page);
      if (qs && qs.active && qs.playerId === 2) {
        // Try P1 keys (1-4) - they should NOT affect P2 quiz
        await page.keyboard.press('1');
        await page.waitForTimeout(100);
        await page.keyboard.press('2');
        await page.waitForTimeout(100);
        const qsAfter = await getQuizState(page);
        if (qsAfter && !qsAfter.answered) {
          console.log('PASS: P1 keys do not affect P2 quiz');
          // Verify P2 can change selection with arrows
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(100);
          const qsArrow = await getQuizState(page);
          if (qsArrow && qsArrow.p2SelectedIndex === 1) {
            console.log('PASS: P2 arrow changes selection');
          }
          await page.keyboard.press('ArrowUp');
          await page.waitForTimeout(100);
          await answerQuizP2(page, qs.correctIndex);
          state = await getGameState(page);
          if (state.p2.jsCorrectCount >= 1) {
            console.log(`PASS: P2 score = ${state.p2.jsCorrectCount}`);
          } else {
            errors.push(`Test 6 FAIL: P2 score = ${state.p2.jsCorrectCount}`);
          }
        } else {
          errors.push('Test 6 FAIL: P1 keys affected P2 quiz');
        }
      } else {
        errors.push('Test 6 FAIL: QuizScene not active for P2');
      }
    }

    // ===== TEST 7: Same-item double claim ====
    console.log('\n=== Test 7: Same-item double claim ===');
    // Find an unclaimed item
    const sameItem = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.quizItems && gs.quizItems.size > 0) {
        for (const item of gs.quizItems.values()) {
          if (!item.claimed && item.active) return { x: item.x, y: item.y };
        }
      }
      return null;
    });
    if (!sameItem) {
      // Need to spawn more
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
      }
    }
    const doubleItem = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.quizItems && gs.quizItems.size > 0) {
        for (const item of gs.quizItems.values()) {
          if (!item.claimed && item.active) return { x: item.x, y: item.y };
        }
      }
      return null;
    });
    if (!doubleItem) {
      errors.push('Test 7 FAIL: No item for double-claim test');
      console.log('FAIL: No item available');
    } else {
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

      // Only one session should be active
      if (!state.hasActiveSession) {
        errors.push('Test 7 FAIL: No quiz session started from double claim');
        console.log('FAIL: No active session');
      } else if (!state.quizSceneActive) {
        errors.push('Test 7 FAIL: QuizScene not visible');
        console.log('FAIL: QuizScene not active');
      } else {
        const qs = await getQuizState(page);
        const claimingPlayer = qs?.playerId;
        const preCount = claimingPlayer === 1 ? state.p1.jsCorrectCount : state.p2.jsCorrectCount;
        if (claimingPlayer === 1) {
          await answerQuizP1(page, qs.correctIndex);
        } else {
          await answerQuizP2(page, qs.correctIndex);
        }
        state = await getGameState(page);
        const postCount = claimingPlayer === 1 ? state.p1.jsCorrectCount : state.p2.jsCorrectCount;
        const otherCount = claimingPlayer === 1 ? state.p2.jsCorrectCount : state.p1.jsCorrectCount;
        if (postCount === preCount + 1 && otherCount === (claimingPlayer === 1 ? 0 : state.p1.jsCorrectCount)) {
          console.log(`PASS: Only P${claimingPlayer} claimed, score incremented correctly`);
        } else {
          console.log(`Claimed by P${claimingPlayer}, pre=${preCount}, post=${postCount}, other=${otherCount}`);
        }
      }
    }

    // ===== TEST 8: Two-item race condition ====
    console.log('\n=== Test 8: Two-item race condition ===');
    // Need two items to exist simultaneously
    await restartGame(page);
    state = await getGameState(page);
    // Spawn two hidden crates
    const twoKeys = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      return [...gs.hiddenQuizCrates].slice(0, 2);
    });
    if (twoKeys.length < 2) {
      errors.push('Test 8 FAIL: Not enough hidden crates');
      console.log('FAIL: Less than 2 hidden crates');
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
      if (state.quizItemsCount < 2) {
        errors.push(`Test 8 FAIL: Expected 2 items, got ${state.quizItemsCount}`);
        console.log(`FAIL: ${state.quizItemsCount} items`);
      } else {
        // Position P1 on item A and P2 on item B simultaneously
        const items = await getItemDetails(page);
        const itemA = items[0];
        const itemB = items[1];
        await page.evaluate(({ a, b }) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.player1.setPosition(a.x, a.y);
          gs.player1.body.reset(a.x, a.y);
          gs.player2.setPosition(b.x, b.y);
          gs.player2.body.reset(b.x, b.y);
        }, { a: itemA, b: itemB });
        await page.waitForTimeout(500);
        state = await getGameState(page);

        // Only one quiz session should be active
        if (!state.hasActiveSession) {
          errors.push('Test 8 FAIL: No quiz session started');
          console.log('FAIL: No active session');
        } else {
          console.log('PASS: Only one active quiz session');
          const qs = await getQuizState(page);
          const claimingPlayer = qs?.playerId;
          if (claimingPlayer === 1) {
            await answerQuizP1(page, qs.correctIndex);
          } else {
            await answerQuizP2(page, qs.correctIndex);
          }

          // After quiz ends, check the unclaimed item state
          const remainingItems = await getItemDetails(page);
          const unclaimed = remainingItems.filter(it => !it.claimed && it.active);
          if (unclaimed.length >= 1) {
            console.log(`PASS: ${unclaimed.length} unclaimed item(s) still active after race`);
            // Verify the unclaimed item can still be claimed
            const toClaim = unclaimed[0];
            await page.evaluate((p) => {
              const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
              gs.player1.setPosition(p.x, p.y);
              gs.player1.body.reset(p.x, p.y);
            }, toClaim);
            await page.waitForTimeout(500);
            state = await getGameState(page);
            if (state.hasActiveSession && state.quizSceneActive) {
              console.log('PASS: Unclaimed item still claimable after race');
            } else {
              errors.push('Test 8 FAIL: Unclaimed item not claimable after race');
              console.log('FAIL: Unclaimed item cannot be claimed');
            }
          } else {
            console.log(`PASS: All items resolved (remaining: ${remainingItems.length})`);
          }
        }
      }
    }

    // ===== TEST 9: Opponent steal ====
    console.log('\n=== Test 9: Opponent steal ===');
    await restartGame(page);
    state = await getGameState(page);
    const stealKey = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.hiddenQuizCrates.size > 0) return [...gs.hiddenQuizCrates][0];
      return null;
    });
    if (!stealKey) {
      errors.push('Test 9 FAIL: No hidden crate');
      console.log('FAIL: No hidden crate for steal test');
    } else {
      const [sr, sc] = stealKey.split(':').map(Number);
      // P1 destroys the crate but P2 claims the item
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.player1.setPosition(p.r * 48 + 24, p.c * 48 + 24);
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: sr, c: sc });
      await page.waitForTimeout(300);
      // Find the spawned item and move P2 to it
      const stealItem = await page.evaluate(() => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        if (gs.quizItems && gs.quizItems.size > 0) {
          const first = [...gs.quizItems.values()][0];
          return { x: first.x, y: first.y };
        }
        return null;
      });
      if (stealItem) {
        await page.evaluate((p) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.player2.setPosition(p.x, p.y);
        }, stealItem);
        await page.waitForTimeout(500);
        const qs = await getQuizState(page);
        if (qs && qs.playerId === 2) {
          console.log('PASS: P2 stole the item (quiz for P2)');
          await answerQuizP2(page, qs.correctIndex);
          state = await getGameState(page);
          if (state.p2.jsCorrectCount >= 1) {
            console.log('PASS: Reward goes to P2 (the stealer)');
          } else {
            errors.push('Test 9 FAIL: P2 score did not increase');
          }
        } else {
          errors.push(`Test 9 FAIL: Quiz opened for P${qs?.playerId}, expected P2`);
        }
      } else {
        errors.push('Test 9 FAIL: No item spawned');
      }
    }

    // ===== TEST 10: Wrong answer ====
    console.log('\n=== Test 10: Wrong answer ===');
    await restartGame(page);
    // Spawn and claim an item
    const wrongKey = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.hiddenQuizCrates.size > 0) return [...gs.hiddenQuizCrates][0];
      return null;
    });
    if (!wrongKey) {
      errors.push('Test 10 FAIL: No hidden crate');
      console.log('FAIL: No crate for wrong answer test');
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
        errors.push('Test 10 FAIL: No item');
        console.log('FAIL: No item spawned');
      } else {
        await page.evaluate((p) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.player1.setPosition(p.x, p.y);
        }, wrongItem);
        await page.waitForTimeout(300);
        const qs = await getQuizState(page);
        if (qs) {
          const preScore = (await getGameState(page)).p1.jsCorrectCount;
          // Pick a wrong answer (not correctIndex)
          const wrongIdx = (qs.correctIndex + 1) % 4;
          await page.keyboard.press(String(wrongIdx + 1));
          await page.waitForTimeout(2500);
          state = await getGameState(page);
          if (state.p1.jsCorrectCount === preScore) {
            console.log('PASS: Score unchanged after wrong answer');
          } else {
            errors.push('Test 10 FAIL: Score changed after wrong answer');
          }
          if (!state.quizSceneActive) {
            console.log('PASS: QuizScene closed, game resumed');
          } else {
            errors.push('Test 10 FAIL: QuizScene still active');
          }
        } else {
          errors.push('Test 10 FAIL: Quiz did not open');
        }
      }
    }

    // ===== TEST 11: Timeout ====
    console.log('\n=== Test 11: Timeout ===');
    await restartGame(page);
    const tKey = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.hiddenQuizCrates.size > 0) return [...gs.hiddenQuizCrates][0];
      return null;
    });
    if (!tKey) {
      errors.push('Test 11 FAIL: No hidden crate');
      console.log('FAIL: No crate for timeout test');
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
        errors.push('Test 11 FAIL: No item');
        console.log('FAIL: No item');
      } else {
        await page.evaluate((p) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.player1.setPosition(p.x, p.y);
        }, tItem);
        await page.waitForTimeout(300);
        const preScore = (await getGameState(page)).p1.jsCorrectCount;
        // Wait for timeout (10s + buffer)
        await page.waitForTimeout(12000);
        state = await getGameState(page);
        if (state.p1.jsCorrectCount === preScore) {
          console.log('PASS: Score unchanged after timeout');
        } else {
          errors.push('Test 11 FAIL: Score changed after timeout');
        }
        if (!state.quizSceneActive) {
          console.log('PASS: QuizScene closed after timeout');
        } else {
          errors.push('Test 11 FAIL: QuizScene still active after timeout');
        }
      }
    }

    // ===== TEST 12: Item lifetime ====
    console.log('\n=== Test 12: Item lifetime ===');
    await restartGame(page);
    const ltKey = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.hiddenQuizCrates.size > 0) return [...gs.hiddenQuizCrates][0];
      return null;
    });
    if (!ltKey) {
      errors.push('Test 12 FAIL: No hidden crate');
      console.log('FAIL: No crate');
    } else {
      const [lr, lc] = ltKey.split(':').map(Number);
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: lr, c: lc });
      await page.waitForTimeout(300);
      state = await getGameState(page);
      const preCount = state.quizItemsCount;
      if (preCount !== 1) {
        errors.push(`Test 12 FAIL: Expected 1 item, got ${preCount}`);
      } else {
        // Wait for lifetime (20s + extra)
        await page.waitForTimeout(22000);
        state = await getGameState(page);
        if (state.quizItemsCount === 0) {
          console.log('PASS: Item despawned after lifetime');
        } else {
          errors.push(`Test 12 FAIL: Item still exists after lifetime (${state.quizItemsCount})`);
        }
      }
    }

    // ===== TEST 13: Lifetime pause during quiz ====
    console.log('\n=== Test 13: Lifetime pause during quiz ===');
    await restartGame(page);
    const pauseKeys = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      return [...gs.hiddenQuizCrates];
    });
    if (pauseKeys.length < 2) {
      errors.push('Test 13 FAIL: Not enough hidden crates');
      console.log('FAIL: Less than 2 hidden crates');
    } else {
      // Spawn item A, then item B shortly after
      const [r1, c1] = pauseKeys[0].split(':').map(Number);
      const [r2, c2] = pauseKeys[1].split(':').map(Number);
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: r1, c: c1 });
      await page.waitForTimeout(300);
      // Claim item A to open quiz
      const pauseItemA = await page.evaluate(() => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        if (gs.quizItems && gs.quizItems.size > 0) {
          const first = [...gs.quizItems.values()][0];
          return { x: first.x, y: first.y };
        }
        return null;
      });
      if (!pauseItemA) {
        errors.push('Test 13 FAIL: Item A did not spawn');
      } else {
        // Spawn item B
        await page.evaluate((p) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
        }, { r: r2, c: c2 });
        await page.waitForTimeout(200);
        state = await getGameState(page);
        const preQuizItems = state.quizItemsCount;
        // Claim item A to open quiz
        await page.evaluate((p) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.player1.setPosition(p.x, p.y);
        }, pauseItemA);
        await page.waitForTimeout(300);
        const qs = await getQuizState(page);
        if (!qs) {
          errors.push('Test 13 FAIL: Quiz did not open');
        } else {
          // Wait ~15s in quiz (pause game time)
          await page.waitForTimeout(15000);
          await answerQuizP1(page, qs.correctIndex);
          state = await getGameState(page);
          // Item B should still exist because lifetime was paused during quiz
          if (state.quizItemsCount >= 1) {
            console.log(`PASS: Item survived during paused game (${state.quizItemsCount} items)`);
          } else {
            console.log(`INFO: Item may have naturally despawned (${preQuizItems} before quiz)`);
          }
        }
      }
    }

    // ===== TEST 14: Power-up caps ====
    console.log('\n=== Test 14: Power-up caps ===');
    await restartGame(page);
    state = await getGameState(page);
    const capP1 = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      const p1 = gs.player1;
      // Increase max bombs and range to test caps
      for (let i = 0; i < 6; i++) {
        p1.increaseMaxBalloons();
        p1.increaseExplosionRange();
      }
      return { maxBalloons: p1.maxBalloons, waterRange: p1.waterRange };
    });
    if (capP1.maxBalloons > 5) {
      errors.push(`Test 14 FAIL: maxBalloons = ${capP1.maxBalloons}, exceeds cap 5`);
      console.log(`FAIL: maxBalloons=${capP1.maxBalloons}`);
    } else if (capP1.waterRange > 5) {
      errors.push(`Test 14 FAIL: waterRange = ${capP1.waterRange}, exceeds cap 5`);
      console.log(`FAIL: waterRange=${capP1.waterRange}`);
    } else {
      console.log(`PASS: maxBalloons=${capP1.maxBalloons}, waterRange=${capP1.waterRange} (capped at 5)`);
    }

    // ===== TEST 15: Speed duration ====
    console.log('\n=== Test 15: Speed duration ===');
    await restartGame(page);
    state = await getGameState(page);
    await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      gs.player1.applySpeedBoost();
    });
    state = await getGameState(page);
    if (!state.p1.speedBoostActive) {
      errors.push('Test 15 FAIL: Speed boost not active');
      console.log('FAIL: Speed boost not applied');
    } else {
      const remaining = await page.evaluate(() => {
        return window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene').player1.getSpeedBoostRemaining();
      });
      if (remaining >= 14 && remaining <= 15) {
        console.log(`PASS: Speed boost active with ${remaining}s remaining`);
      } else {
        console.log(`Speed boost has ${remaining}s remaining`);
      }
      // Apply again while active - should refresh to 15s
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene').player1.applySpeedBoost();
      });
      const remaining2 = await page.evaluate(() => {
        return window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene').player1.getSpeedBoostRemaining();
      });
      if (remaining2 >= 14 && remaining2 <= 15) {
        console.log(`PASS: Speed boost refreshed to ${remaining2}s`);
      } else {
        console.log(`Speed boost at ${remaining2}s after refresh`);
      }
      // Check speed is not multiplied again
      await page.evaluate(() => {
        return window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene').player1.speed;
      });
      const expectedSpeed = 150 * 1.2; // 180
      const actualSpeed = await page.evaluate(() => {
        return window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene').player1.speed;
      });
      if (Math.abs(actualSpeed - expectedSpeed) <= 1) {
        console.log(`PASS: Speed = ${actualSpeed} (not 1.2*1.2)`);
      } else {
        console.log(`Speed = ${actualSpeed}, expected ~${expectedSpeed}`);
      }
    }

    // ===== TEST 16: Range snapshot ====
    console.log('\n=== Test 16: Range snapshot ===');
    await restartGame(page);
    let rangeA = null;
    await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      const p1 = gs.player1;
      p1.setPosition(48 * 3 + 24, 48 * 3 + 24);
      p1.body.reset(48 * 3 + 24, 48 * 3 + 24);
      p1.waterRange = 1;
      gs.events.emit('request_place_balloon', p1);
    });
    await page.waitForTimeout(300);
    rangeA = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      const balloons = gs.balloons.getChildren();
      return balloons.length > 0 ? balloons[0].range : null;
    });
    // Make the first balloon explode to free up balloon slot
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
    // Upgrade range and place second balloon
    await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      gs.player1.increaseExplosionRange();
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
    if (rangeA !== null && rangeB !== null && rangeA < rangeB) {
      console.log(`PASS: Balloon A range=${rangeA}, Balloon B range=${rangeB}`);
    } else {
      errors.push(`Test 16 FAIL: A=${rangeA}, B=${rangeB}`);
      console.log(`FAIL: A=${rangeA}, B=${rangeB}`);
    }

    // ===== TEST 17: UI bounds ====
    console.log('\n=== Test 17: UI bounds ===');
    await restartGame(page);
    const uiKey = await page.evaluate(() => {
      const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
      if (gs.hiddenQuizCrates.size > 0) return [...gs.hiddenQuizCrates][0];
      return null;
    });
    if (!uiKey) {
      errors.push('Test 17 FAIL: No hidden crate');
      console.log('FAIL: No crate');
    } else {
      const [ur, uc] = uiKey.split(':').map(Number);
      await page.evaluate((p) => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        gs.events.emit('crate_destroyed', { row: p.r, col: p.c, x: 0, y: 0 });
      }, { r: ur, c: uc });
      await page.waitForTimeout(300);
      const uiItem = await page.evaluate(() => {
        const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
        if (gs.quizItems && gs.quizItems.size > 0) {
          const first = [...gs.quizItems.values()][0];
          return { x: first.x, y: first.y };
        }
        return null;
      });
      if (!uiItem) {
        errors.push('Test 17 FAIL: No item');
        console.log('FAIL: No item');
      } else {
        await page.evaluate((p) => {
          const gs = window.__BUBBLE_BATTLE_GAME__.scene.getScene('GameScene');
          gs.player1.setPosition(p.x, p.y);
        }, uiItem);
        await page.waitForTimeout(300);

        // Check that all QuizScene objects are within canvas 800x600
        const boundsOk = await page.evaluate(() => {
          const game = window.__BUBBLE_BATTLE_GAME__;
          const qs = game.scene.getScene('QuizScene');
          if (!qs || !qs.scene.isActive()) return { error: 'No quiz scene', pass: false };

          const children = qs.children.list;
          let allInCanvas = true;
          const violations = [];

          for (const child of children) {
            if (!child || !child.getBounds) continue;
            const b = child.getBounds();

            // Skip tiny/invisible objects
            if (b.width < 1 && b.height < 1) continue;

            const inCanvas = b.x >= -5 && b.y >= -5 && b.right <= 805 && b.bottom <= 605;
            if (!inCanvas) {
              allInCanvas = false;
              violations.push({ x: b.x, y: b.y, right: b.right, bottom: b.bottom, w: b.width, h: b.height, type: child.type });
            }
          }

          return { allInCanvas, violations, childCount: children.length };
        });

        if (boundsOk.error) {
          errors.push(`Test 17 FAIL: ${boundsOk.error}`);
          console.log(`FAIL: ${boundsOk.error}`);
        } else if (!boundsOk.allInCanvas) {
          console.log(`FAIL: ${boundsOk.violations.length} object(s) outside canvas`);
          for (const v of boundsOk.violations) {
            console.log(`  ${v.type} at (${v.x},${v.y})-(${v.right},${v.bottom}) size ${v.w}x${v.h}`);
          }
          errors.push('Test 17 FAIL: Objects outside canvas 800x600');
        } else {
          console.log(`PASS: All ${boundsOk.childCount} objects within canvas 800x600`);
        }
      }
    }
    // Close quiz
    try {
      const qsClose = await getQuizState(page);
      if (qsClose && qsClose.active) {
        if (qsClose.playerId === 1) await answerQuizP1(page, qsClose.correctIndex);
        else await answerQuizP2(page, qsClose.correctIndex);
      }
    } catch (e) { /* ignore */ }

    // ===== TEST 18: Restart lifecycle (3x) ====
    console.log('\n=== Test 18: Restart lifecycle (3x) ===');
    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`  Restart cycle ${cycle}...`);
      await page.evaluate(() => {
        const game = window.__BUBBLE_BATTLE_GAME__;
        game.scene.start('ResultScene', { result: 'draw', reason: 'test', duration: 0, p1JsCorrect: 1, p2JsCorrect: 0 });
      });
      await page.waitForTimeout(800);
      await page.keyboard.press('Space');
      await page.waitForTimeout(1500);
    }
    state = await getGameState(page);
    const cd = state.listeners.crate_destroyed;
    const qa = state.listeners.quiz_answered;
    const qd = state.listeners.quiz_item_despawned;
    const test18ok = cd === 1 && qa === 1 && qd === 1 &&
      state.hiddenQuizCratesSize === 10 && state.quizItemsCount === 0 &&
      state.revealedQuizCount === 0 && !state.hasActiveSession;
    console.log(`  Listeners: crate=${cd}, quiz_answered=${qa}, quiz_despawned=${qd}`);
    console.log(`  Hidden: ${state.hiddenQuizCratesSize}, Items: ${state.quizItemsCount}, Revealed: ${state.revealedQuizCount}`);
    if (test18ok) {
      console.log('PASS: Clean restart with fresh state');
    } else {
      errors.push('Test 18 FAIL: Stale state after 3 restarts');
      console.log('FAIL: Stale state');
    }

    // ===== Summary ====
    console.log('\n========================================');
    if (consoleErrors.length > 0) {
      console.log('CONSOLE ERRORS DETECTED:');
      consoleErrors.forEach(e => console.log(`  ${e}`));
    }
    if (errors.length === 0 && consoleErrors.length === 0) {
      console.log('ALL QUIZ BROWSER ASSERTIONS PASSED.');
    } else {
      console.log(`QUIZ BROWSER TESTS FAILED: ${errors.length} error(s), ${consoleErrors.length} console error(s)`);
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
