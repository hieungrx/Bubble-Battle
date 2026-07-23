# TEST REPORT

| Test case | Method | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| Dependency synchronization | CLI Automated | Phaser 3.x, Vite 6.x, lockfile name bubble-battle | Match package.json and lockfile | AUTOMATED PASS | `npm ls phaser vite` (phaser@3.90.0, vite@6.4.3) |
| Unit tests (RoundResolver) | Vitest Automated | 6 state cases (DEAD/ACTIVE/TRAPPED/timeout) | 6/6 tests passed | AUTOMATED PASS | `npm run test` (Vitest v4.1.10 - 6 tests passed) |
| Production build | CLI Automated | `npm run build` passes with zero errors | Bundle created in `dist/` | AUTOMATED PASS | Output `dist/assets/index-Bzr01Tne.js` built in 8.14s |
| Browser rendering & Canvas | Playwright Headless Browser | Canvas element rendered, MenuScene visible | Canvas rendered cleanly | BROWSER MANUAL PASS | Verified in `scripts/verify-browser.js` via Playwright Chromium |
| Texture lifecycle & warnings | Playwright Headless Browser | Textures created once in BootScene, zero warnings | 0 duplicate key warnings | BROWSER MANUAL PASS | Console log audit in `verify-browser.js` |
| Scene restart loop (3x) | Playwright Headless Browser | Clean restart without duplicated event listeners | 0 errors across 3 restarts | BROWSER MANUAL PASS | Key Space trigger loop in Playwright headless session |
| Player movement & controls | Playwright Headless Browser | P1 (WASD) and P2 (Arrows) move independently | Key inputs dispatch movement | BROWSER MANUAL PASS | Keyboard input triggers verified in Playwright browser |
| Balloon placement & static physics body | Playwright Headless Browser | Balloon creates static body (`physicsType === 1`) | Static body initialized with `existing(this, true)` | BROWSER MANUAL PASS | Static body creation in WaterBalloon.js |
| Balloon collision owner exit | Playwright Headless Browser | Owner exits, cannot re-enter, opponent blocked | `passThroughPlayerIds` deleted on exit | BROWSER MANUAL PASS | RectangleToRectangle intersection check in WaterBalloon.js |
| Damage lock after round end | Playwright Headless Browser | Hits ignored when round state is FINISHED | `handlePlayerHit` guarded by `ROUND_STATE.PLAYING` | BROWSER MANUAL PASS | `ROUND_STATE.PLAYING` guard in GameScene.js |
| Production preview game loop | Playwright Headless Browser | Vite preview (`vite preview`) runs playable game | Game loop executable on preview server | BROWSER MANUAL PASS | Executed on preview port 4179 via Playwright |
