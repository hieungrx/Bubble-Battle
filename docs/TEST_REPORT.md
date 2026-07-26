# TEST REPORT

| Test case | Method | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| Dependency synchronization | CLI Automated | Phaser 3.x, Vite 6.x, lockfile name bubble-battle | Match package.json and lockfile | AUTOMATED PASS | `npm ls phaser vite` (phaser@3.90.0, vite@6.4.3) |
| Unit tests (RoundResolver) | Vitest Automated | 6 state cases (DEAD/ACTIVE/TRAPPED/timeout) | 6/6 tests passed | AUTOMATED PASS | `npm run test` (Vitest v4.1.10 - 6 tests passed) |
| Unit tests (Quiz) | Vitest Automated | 19 test cases (question bank validation, quiz utils) | 19/19 tests passed | AUTOMATED PASS | `npm run test` (Vitest - quiz.test.js) |
| Production build | CLI Automated | `npm run build` passes with zero errors | Bundle created in `dist/` | AUTOMATED PASS | Production bundle generated successfully in dist/. |
| Browser rendering & Canvas | Playwright Headless Browser | Canvas element rendered, MenuScene visible | Canvas rendered cleanly | BROWSER AUTOMATED PASS | Asserted in `scripts/verify-browser.js` via Playwright Chromium |
| Texture lifecycle & warnings | Playwright Headless Browser | Textures created once in BootScene | 0 duplicate key warnings | BROWSER AUTOMATED PASS | Console log audit for duplicate keys in `verify-browser.js` |
| Scene restart loop (3x) | Playwright Headless Browser | Clean restart without duplicated event listeners | 0 errors across 3 restarts, listener counts 1/1/1/1 | BROWSER AUTOMATED PASS | Restart loop 3x automated in `verify-browser.js` |
| Player movement & controls | Playwright Headless Browser | P1 (WASD) and P2 (Arrows) move independently | Key inputs dispatch movement, bounding box changes | BROWSER AUTOMATED PASS | Coordinate change assertions in `verify-browser.js` |
| Balloon placement & static physics body | Playwright Headless Browser | Balloon creates static body (`physicsType === 1`) | Static body initialized with `existing(this, true)` | BROWSER AUTOMATED PASS | Physics type asserted in `verify-browser.js` |
| Balloon collision owner exit | Playwright Headless Browser | Owner exits, cannot re-enter, opponent blocked | `passThroughPlayerIds` deleted on exit via overlap check | BROWSER AUTOMATED PASS | Collision state assertions in `verify-browser.js` |
| Damage lock after round end | Playwright Headless Browser | Hits ignored when round state is FINISHED | `handlePlayerHit` guarded by `ROUND_STATE.PLAYING` | BROWSER AUTOMATED PASS | Hit test when FINISHED asserted in `verify-browser.js` |
| Production preview game loop | Playwright Headless Browser | Vite preview runs playable game | Game loop executable on preview server | BROWSER AUTOMATED PASS | Executed on preview port 4179 via Playwright |
| Quiz Item spawn & singleton | Playwright Headless Browser | Crate destroyed spawns Quiz Item, max 1 at a time | 1 item spawned, second ignored | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 1 |
| QuizScene open on collect | Playwright Headless Browser | Player overlap opens QuizScene overlay | QuizScene active, item marked collected | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 2 |
| Round timer pause during quiz | Playwright Headless Browser | Timer does not decrease while quiz is open | Timer unchanged after 2.5s in quiz | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 3 |
| Correct answer grants reward | Playwright Headless Browser | JS score +1, power-up applied, QuizScene closes | Score incremented, reward applied, scene closed | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 4 |
| Wrong answer no reward | Playwright Headless Browser | Incorrect answer does not change JS score | Score unchanged after wrong answer | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 5 |
| Timeout no reward | Playwright Headless Browser | Timer expiry closes quiz, no changes to score | QuizScene closed, score unchanged | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 6 |
| Balloon range snapshot | Playwright Headless Browser | Balloon A keeps original range, Balloon B uses new range | A range=1, B range=2 after power-up | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 7 |
| Quiz restart lifecycle (3x) | Playwright Headless Browser | 3 restarts without listener duplication | Listener counts 1/1 after 3 restarts | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 8 |
| No stale QuizScene after restart | Playwright Headless Browser | QuizScene not active/visible after restart | QuizScene cleaned after restart | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 9 |
| QA full pipeline (2x consecutive) | CLI Automated | Both runs pass with zero failures | Both runs ALL ASSERTIONS PASSED | AUTOMATED PASS | `npm run qa` executed twice consecutively |

Manual playthrough: NOT VERIFIED
