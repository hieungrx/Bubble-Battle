# TEST REPORT

| Test case | Method | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| Dependency synchronization | CLI Automated | Phaser 3.x, Vite 6.x, lockfile name bubble-battle | Match package.json and lockfile | AUTOMATED PASS | `npm ls phaser vite` (phaser@3.90.0, vite@6.4.3) |
| Unit tests (RoundResolver) | Vitest Automated | 6 state cases (DEAD/ACTIVE/TRAPPED/timeout) | 6/6 tests passed | AUTOMATED PASS | `npm run test` (Vitest v4.1.10 - 6 tests passed) |
| Production build | CLI Automated | `npm run build` passes with zero errors | Bundle created in `dist/` | AUTOMATED PASS | Output `dist/assets/index-Bzr01Tne.js` built in 8.14s |
| Browser rendering & Canvas | Playwright Headless Browser | Canvas element rendered, MenuScene visible | Canvas rendered cleanly | BROWSER AUTOMATED PASS | Asserted in `scripts/verify-browser.js` via Playwright Chromium |
| Texture lifecycle & warnings | Playwright Headless Browser | Textures created once in BootScene, zero warnings | 0 duplicate key warnings | BROWSER AUTOMATED PASS | Console log audit in `verify-browser.js` |
| Scene restart loop (3x) | Playwright Headless Browser | Clean restart without duplicated event listeners | 0 errors across 3 restarts, balloon properly reset | BROWSER AUTOMATED PASS | Restart loop 3x automated in Playwright script |
| Player movement & controls | Playwright Headless Browser | P1 (WASD) and P2 (Arrows) move independently | Key inputs dispatch movement, bounding box changes | BROWSER AUTOMATED PASS | Coordinate change assertions in `verify-browser.js` |
| Balloon placement & static physics body | Playwright Headless Browser | Balloon creates static body (`physicsType === 1`) | Static body initialized with `existing(this, true)` | BROWSER AUTOMATED PASS | Physics type asserted in `verify-browser.js` |
| Balloon collision owner exit | Playwright Headless Browser | Owner exits, cannot re-enter, opponent blocked | `passThroughPlayerIds` deleted on exit via overlap check | BROWSER AUTOMATED PASS | Collision state assertions in `verify-browser.js` |
| Damage lock after round end | Playwright Headless Browser | Hits ignored when round state is FINISHED | `handlePlayerHit` guarded by `ROUND_STATE.PLAYING` | BROWSER AUTOMATED PASS | Hit test when FINISHED asserted in `verify-browser.js` |
| Production preview game loop | Playwright Headless Browser | Vite preview (`vite preview`) runs playable game | Game loop executable on preview server | BROWSER AUTOMATED PASS | Executed on preview port 4173 via Playwright |
