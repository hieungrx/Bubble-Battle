import { TILE } from '../constants/tileTypes.js';

export const QUIZ_DROP_RULES = {
  hiddenItemsPerRound: 10,
  spawnSafeRadius: 2,
  itemLifetimeMs: 20000
};

export function createGridKey(row, col) {
  return `${row}:${col}`;
}

export function parseGridKey(key) {
  const [r, c] = key.split(':').map(Number);
  return { row: r, col: c };
}

export function isInsideSpawnSafeZone(row, col, spawnPoints, radius = QUIZ_DROP_RULES.spawnSafeRadius) {
  for (const sp of spawnPoints) {
    const dist = Math.abs(row - sp.row) + Math.abs(col - sp.col);
    if (dist <= radius) {
      return true;
    }
  }
  return false;
}

export function getEligibleCrates(levelData, spawnPoints, safeRadius = QUIZ_DROP_RULES.spawnSafeRadius) {
  const crates = [];

  for (let row = 0; row < levelData.length; row++) {
    const cols = levelData[row];
    for (let col = 0; col < cols.length; col++) {
      if (cols[col] === TILE.CRATE) {
        if (!isInsideSpawnSafeZone(row, col, spawnPoints, safeRadius)) {
          crates.push({ row, col });
        }
      }
    }
  }

  return crates;
}

export function shuffleCopy(items, randomFn = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function selectHiddenQuizCrates(eligibleCrates, count = QUIZ_DROP_RULES.hiddenItemsPerRound, randomFn = Math.random) {
  const shuffled = shuffleCopy(eligibleCrates, randomFn);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));
  return selected;
}
