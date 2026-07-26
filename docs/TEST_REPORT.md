# TEST REPORT

| Test case | Method | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| Dependency synchronization | CLI Automated | Phaser 3.x, Vite 6.x, lockfile name bubble-battle | Match package.json and lockfile | AUTOMATED PASS | `npm ls phaser vite` (phaser@3.90.0, vite@6.4.3) |
| Unit tests (RoundResolver) | Vitest Automated | 6 state cases (DEAD/ACTIVE/TRAPPED/timeout) | 7/7 tests passed | AUTOMATED PASS | `npm run test` (Vitest v4.1.10) |
| Unit tests (Quiz) | Vitest Automated | 19 test cases (question bank validation, quiz utils) | 19/19 tests passed | AUTOMATED PASS | `npm run test` (quiz.test.js) |
| Unit tests (Quiz Drops) | Vitest Automated | 21 test cases (grid keys, eligible crates, selection, constants) | 21/21 tests passed | AUTOMATED PASS | `npm run test` (quizDrops.test.js) |
| Unit tests (Power-ups) | Vitest Automated | 23 test cases (POWER_UP_RULES, caps, font helpers, layout bounds) | 23/23 tests passed | AUTOMATED PASS | `npm run test` (powerUps.test.js) |
| Production build | CLI Automated | `npm run build` passes with zero errors | Bundle created in `dist/` | AUTOMATED PASS | Production bundle generated |
| Browser rendering & Canvas | Playwright Headless Browser | Canvas element rendered, MenuScene visible | Canvas rendered cleanly | BROWSER AUTOMATED PASS | `scripts/verify-browser.js` |
| Texture lifecycle & warnings | Playwright Headless Browser | Textures created once in BootScene | 0 duplicate key warnings | BROWSER AUTOMATED PASS | `scripts/verify-browser.js` |
| Scene restart loop (3x) | Playwright Headless Browser | Clean restart without duplicated event listeners | 0 errors across 3 restarts, listener counts 1/1/1/1 | BROWSER AUTOMATED PASS | `scripts/verify-browser.js` |
| Player movement & controls | Playwright Headless Browser | P1 (WASD) and P2 (Arrows) move independently | Key inputs dispatch movement, bounding box changes | BROWSER AUTOMATED PASS | `scripts/verify-browser.js` |
| Balloon placement & static physics body | Playwright Headless Browser | Balloon creates static body (`physicsType === 1`) | Static body initialized | BROWSER AUTOMATED PASS | `scripts/verify-browser.js` |
| Balloon collision owner exit | Playwright Headless Browser | Owner exits, cannot re-enter, opponent blocked | `passThroughPlayerIds` deleted on exit | BROWSER AUTOMATED PASS | `scripts/verify-browser.js` |
| Damage lock after round end | Playwright Headless Browser | Hits ignored when round state is FINISHED | Guard by `ROUND_STATE.PLAYING` | BROWSER AUTOMATED PASS | `scripts/verify-browser.js` |
| Production preview game loop | Playwright Headless Browser | Vite preview runs playable game | Game loop executable on preview server | BROWSER AUTOMATED PASS | Preview on port 4179 via Playwright |
| Exact hidden crates (10/round) | Playwright Headless Browser | `hiddenQuizCrates.size === 10` | 10 crates | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 1 |
| Normal crate no spawn | Playwright Headless Browser | Destroying normal crate creates 0 items | 0 quiz items | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 2 |
| Hidden crate spawn & position | Playwright Headless Browser | Destroying hidden crate creates 1 item at grid position | 1 item at correct position | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 3 |
| Multiple items coexist (exact 3) | Playwright Headless Browser | Reveal 3 hidden crates → `quizItems.size === 3` | Exactly 3 items | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 4 |
| P1 input isolation | Playwright Headless Browser | `1-4` submits, Arrow/Enter do not | P2 keys ignored for P1 | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 5 |
| P2 input isolation | Playwright Headless Browser | Arrows change selection, Enter submits, `1-4` ignored | P1 keys ignored for P2 | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 6 |
| Same-item double claim | Playwright Headless Browser | P1 & P2 touch same item → only 1 claims | 1 session, 1 reward | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 7 |
| Two-item race condition | Playwright Headless Browser | P1→A, P2→B same frame → 1 session, B stays active | 1 session, other item claimable | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 8 |
| Opponent steal | Playwright Headless Browser | P1 destroys crate, P2 touches item → QuizScene for P2 | P2 gets quiz | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 9 |
| Wrong answer no reward | Playwright Headless Browser | Wrong answer → score unchanged, item consumed, game resumes | Score unchanged, game active | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 10 |
| Timeout no reward | Playwright Headless Browser | Timer expires → score unchanged, quiz closes, game resumes | Score unchanged, game resumes | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 11 |
| Item lifetime | Playwright Headless Browser | Item auto-despawns after 20s | Item removed from map | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 12 |
| Lifetime pause during quiz | Playwright Headless Browser | Item timer pauses while GameScene paused | Item survives quiz duration | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 13 |
| Power-up caps (5/5) | Playwright Headless Browser | `maxBalloons ≤ 5`, `waterRange ≤ 5` | Capped at 5 | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 14 |
| Speed duration + refresh | Playwright Headless Browser | 15s duration, refresh resets timer, no stacking | 15s, speed = base × 1.2 | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 15 |
| Range snapshot | Playwright Headless Browser | Balloon placed before upgrade keeps old range | A=1, B=2 | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 16 |
| UI bounds | Playwright Headless Browser | All objects within panel and canvas 800×600 | Panel, answers, overlay within bounds | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 17 |
| Restart lifecycle (3x) | Playwright Headless Browser | 3 restarts: 10 hidden, 0 items, 0 session, listeners=1 | Clean state after 3 restarts | BROWSER AUTOMATED PASS | `scripts/verify-quiz.js` test 18 |
| QA full pipeline (2x consecutive) | CLI Automated | Both runs pass with zero failures | Both runs ALL ASSERTIONS PASSED | AUTOMATED PASS | `npm run qa` executed twice consecutively |

Manual playthrough: NOT VERIFIED
