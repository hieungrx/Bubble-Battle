# PROJECT HANDOFF CURRENT

## Project
Bubble Battle: Campus Chaos

## Current Branch
feature/bubble-battle-asm

## Current Package
Competitive 10-Item Quiz System — Final Hardening

## Completed
- Trapped player resolution fix (`resolvePlayerStates` helper with 6 Vitest unit tests)
- Damage lock after round end in `handlePlayerHit()`
- WaterBalloon static physics body unification (`scene.physics.add.existing(this, true)`)
- Automated Vitest test suite (`npm run test` — 77 tests across 4 test files)
- Automated Playwright browser verification (`node scripts/verify-browser.js`)
- Educational JavaScript Quiz System (10 questions, QuizScene overlay, 3 power-ups)
- Competitive quiz race condition fix (`handleQuizItemOverlap` checks `activeQuizSession` BEFORE `item.claim()`)
- Quiz text overflow fix (760×560 panel, adaptive fonts, separate cursor, result overlay, wordWrap)
- P1/P2 input isolation (P1: 1-4, P2: Arrow Up/Down + Enter)
- Power-up balance update (+20% speed, 15s duration, Balloon cap 5, Range cap 5)
- Centralized `POWER_UP_RULES` constants (no hard-coded values)
- Item lifetime increased to 20s (from 15s)
- 18 hardened browser tests (no false-pass branches, strict exact assertions)
- Crate count verification (72 total, 68 eligible, 10 selected per round)
- `qa:browser` script avoiding duplicate builds
- Test 17: UI bounds verified across 10 questions × 2 player modes = 20 layouts via `JS_QUESTIONS` import
- Test 13: lifetime timer readability is strict assertion — missing data causes failure
- Speed Boost clock uses Phaser scene time for pause-safe countdown
- All event listeners cleaned in `GameScene.shutdown()` (8 handlers)
- `quizLayout.js` extracted: font helpers reusable in tests
- Documentation updates (README, TEST_REPORT, PRESENTATION_GUIDE)

## Commands
npm run dev
npm run test
npm run build
npm run preview
npm run qa
npm run qa:browser
npm run test:quiz-browser

## Build Status
Pass

## Manual Test Status
Automated Vitest unit tests (77/77 PASS), Playwright gameplay tests (ALL PASS), Playwright quiz tests (18 test cases, strict assertions PASS). Manual playthrough: NOT VERIFIED.

## Known Bugs
None observed during executed tests.

## Technical Decisions
- Extracted round state resolution to pure function `resolvePlayerStates(p1State, p2State, isTimeout)` in `src/utils/roundResolver.js`.
- Implemented 6 unit tests in `tests/roundResolver.test.js` for all player state combinations.
- Added `ROUND_STATE.PLAYING` guard to `handlePlayerHit()` in `GameScene.js`.
- Created `WaterBalloon` static Arcade body at instantiation via `scene.physics.add.existing(this, true)`.
- Added Playwright browser test script `scripts/verify-browser.js`.
- Added Quiz system: `src/data/jsQuestions.js` (10 questions), `src/utils/quiz.js` (pure functions), `src/entities/QuizItem.js`, `src/scenes/QuizScene.js` overlay.
- Balloon range captured at placement time (not explosion) for correct power-up semantics.
- GameScene shutdown stops QuizScene to prevent accessing dead scene during round transition.
- Race condition fix: `handleQuizItemOverlap` handler checks all conditions before `item.claim()`.
- QuizScene layout: 760×560 panel, adaptive font sizing, separate P2 cursor, result overlay with depth.
- Centralized `POWER_UP_RULES` in `src/constants/gameRules.js` (speedMultiplier: 1.2, speedDurationMs: 15000, maxBalloons: 5, maxExplosionRange: 5).
- Item lifetime extended to 20000ms in `QUIZ_DROP_RULES.itemLifetimeMs`.
- Browser test script hardened with 18 strict tests — no false-pass INFO/PASS branches.

## Files Changed
- package.json
- src/constants/gameRules.js
- src/scenes/GameScene.js
- src/scenes/QuizScene.js
- src/entities/Player.js
- src/entities/WaterBalloon.js
- src/entities/QuizItem.js
- src/data/jsQuestions.js
- src/utils/quiz.js
- src/utils/quizDrops.js
- scripts/verify-quiz.js
- tests/quizDrops.test.js
- tests/powerUps.test.js (NEW)
- README.md
- docs/PRESENTATION_GUIDE.md
- docs/TEST_REPORT.md
- PROJECT_HANDOFF_CURRENT.md
- docs/SUBMISSION_CHECKLIST.md

## Scope Exclusions
Multiplayer, WebSocket, Backend, DB, Login, 3D, Custom Assets, AI Bot, Online.

## Exact Next Instruction
Manual QA playthrough required. Reviewer should play the game and verify quiz flow manually.
