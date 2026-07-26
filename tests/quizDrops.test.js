import { describe, it, expect } from 'vitest';
import {
  createGridKey,
  parseGridKey,
  isInsideSpawnSafeZone,
  getEligibleCrates,
  shuffleCopy,
  selectHiddenQuizCrates,
  QUIZ_DROP_RULES
} from '../src/utils/quizDrops.js';
import { LEVEL_01 } from '../src/data/level01.js';
import { TILE } from '../src/constants/tileTypes.js';

describe('createGridKey', () => {
  it('should create key from row and col', () => {
    expect(createGridKey(5, 7)).toBe('5:7');
  });

  it('should create key with zeros', () => {
    expect(createGridKey(0, 0)).toBe('0:0');
  });
});

describe('parseGridKey', () => {
  it('should parse key back to row and col', () => {
    const result = parseGridKey('5:7');
    expect(result.row).toBe(5);
    expect(result.col).toBe(7);
  });
});

describe('isInsideSpawnSafeZone', () => {
  const spawnPoints = [{ row: 1, col: 1 }, { row: 9, col: 13 }];

  it('should return true for exact spawn position', () => {
    expect(isInsideSpawnSafeZone(1, 1, spawnPoints)).toBe(true);
    expect(isInsideSpawnSafeZone(9, 13, spawnPoints)).toBe(true);
  });

  it('should return true within radius', () => {
    expect(isInsideSpawnSafeZone(1, 2, spawnPoints)).toBe(true);
    expect(isInsideSpawnSafeZone(3, 1, spawnPoints)).toBe(true);
    expect(isInsideSpawnSafeZone(9, 11, spawnPoints)).toBe(true);
  });

  it('should return false outside radius', () => {
    expect(isInsideSpawnSafeZone(4, 1, spawnPoints)).toBe(false);
    expect(isInsideSpawnSafeZone(5, 5, spawnPoints)).toBe(false);
    expect(isInsideSpawnSafeZone(9, 9, spawnPoints)).toBe(false);
  });

  it('should accept custom radius', () => {
    expect(isInsideSpawnSafeZone(5, 1, spawnPoints, 1)).toBe(false);
    expect(isInsideSpawnSafeZone(5, 1, spawnPoints, 5)).toBe(true);
  });
});

describe('getEligibleCrates', () => {
  const testMap = [
    [1, 1, 1, 1, 1],
    [1, 0, 2, 2, 1],
    [1, 2, 2, 0, 1],
    [1, 2, 0, 2, 1],
    [1, 1, 1, 1, 1],
  ];
  const spawnPoints = [{ row: 1, col: 1 }, { row: 3, col: 3 }];

  it('should return only CRATE tiles', () => {
    const result = getEligibleCrates(testMap, spawnPoints);
    for (const c of result) {
      expect(testMap[c.row][c.col]).toBe(TILE.CRATE);
    }
  });

  it('should exclude crates in safe zone', () => {
    const result = getEligibleCrates(testMap, spawnPoints);
    // (1,2) and (2,1) are near spawn (1,1)
    const keys = result.map(c => createGridKey(c.row, c.col));
    expect(keys).not.toContain('1:2'); // dist 1 from P1
    expect(keys).not.toContain('2:1'); // dist 1 from P1
  });

  it('should not mutate original map', () => {
    const copy = testMap.map(r => [...r]);
    getEligibleCrates(testMap, spawnPoints);
    expect(testMap).toEqual(copy);
  });
});

describe('shuffleCopy', () => {
  it('should not mutate the original array', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const copy = [...original];
    shuffleCopy(original, () => 0.5);
    expect(original).toEqual(copy);
  });

  it('should return array of same length', () => {
    const items = [1, 2, 3, 4, 5];
    const shuffled = shuffleCopy(items);
    expect(shuffled.length).toBe(items.length);
  });

  it('should produce different order with different seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = shuffleCopy(items, () => 0.1);
    const b = shuffleCopy(items, () => 0.9);
    expect(a.join(',')).not.toBe(b.join(','));
  });

  it('should produce same order with same seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = shuffleCopy(items, () => 0.42);
    const b = shuffleCopy(items, () => 0.42);
    expect(a.join(',')).toBe(b.join(','));
  });
});

describe('selectHiddenQuizCrates', () => {
  const eligible = [
    { row: 2, col: 2 }, { row: 2, col: 3 }, { row: 3, col: 1 },
    { row: 3, col: 2 }, { row: 4, col: 1 }, { row: 4, col: 4 },
  ];

  it('should select at most 3 crates', () => {
    const result = selectHiddenQuizCrates(eligible, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('should not select duplicate coordinates', () => {
    const result = selectHiddenQuizCrates(eligible, 5);
    const keys = new Set(result.map(c => createGridKey(c.row, c.col)));
    expect(keys.size).toBe(result.length);
  });

  it('should return fewer crates if not enough eligible', () => {
    const few = [{ row: 1, col: 1 }];
    const result = selectHiddenQuizCrates(few, 3);
    expect(result.length).toBe(1);
  });

  it('should return empty array for empty eligible list', () => {
    const result = selectHiddenQuizCrates([], 3);
    expect(result.length).toBe(0);
  });

  it('should not mutate the eligible array', () => {
    const copy = [...eligible];
    selectHiddenQuizCrates(eligible, 3);
    expect(eligible).toEqual(copy);
  });

  it('should produce deterministic result with seeded random', () => {
    const result = selectHiddenQuizCrates(eligible, 3, () => 0.5);
    expect(result.length).toBe(3);
  });
});

describe('QUIZ_DROP_RULES constants', () => {
  it('should have itemLifetimeMs of 20000', () => {
    expect(QUIZ_DROP_RULES.itemLifetimeMs).toBe(20000);
  });

  it('should have hiddenItemsPerRound of 10', () => {
    expect(QUIZ_DROP_RULES.hiddenItemsPerRound).toBe(10);
  });

  it('should have spawnSafeRadius of 2', () => {
    expect(QUIZ_DROP_RULES.spawnSafeRadius).toBe(2);
  });
});

describe('Level 01 crate counts', () => {
  const spawnPoints = [{ row: 1, col: 1 }, { row: 9, col: 13 }];

  it('should have exactly 72 CRATE tiles in LEVEL_01', () => {
    let count = 0;
    for (const row of LEVEL_01) {
      for (const cell of row) {
        if (cell === TILE.CRATE) count++;
      }
    }
    expect(count).toBe(72);
  });

  it('should have exactly 68 eligible crates after safe-zone filtering', () => {
    const eligible = getEligibleCrates(LEVEL_01, spawnPoints);
    expect(eligible.length).toBe(68);
  });

  it('should select exactly 10 hidden crates from eligible pool', () => {
    const eligible = getEligibleCrates(LEVEL_01, spawnPoints);
    const selected = selectHiddenQuizCrates(eligible, 10);
    expect(selected.length).toBe(10);
  });

  it('should have no duplicate coordinates in selection', () => {
    const eligible = getEligibleCrates(LEVEL_01, spawnPoints);
    const selected = selectHiddenQuizCrates(eligible, 10);
    const keys = new Set(selected.map(c => createGridKey(c.row, c.col)));
    expect(keys.size).toBe(10);
  });

  it('should exclude all spawn-adjacent positions', () => {
    const eligible = getEligibleCrates(LEVEL_01, spawnPoints);
    const eligibleSet = new Set(eligible.map(c => createGridKey(c.row, c.col)));
    // (1,3) and (3,1) should be excluded from (1,1) safe zone radius 2
    expect(eligibleSet.has(createGridKey(1, 3))).toBe(false);
    expect(eligibleSet.has(createGridKey(3, 1))).toBe(false);
    // (7,13) and (9,11) should be excluded from (9,13) safe zone radius 2
    expect(eligibleSet.has(createGridKey(7, 13))).toBe(false);
    expect(eligibleSet.has(createGridKey(9, 11))).toBe(false);
  });
});
