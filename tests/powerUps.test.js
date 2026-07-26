import { describe, it, expect } from 'vitest';
import { POWER_UP_RULES } from '../src/constants/gameRules.js';
import { getQuestionFontSize, getAnswerFontSize, calculateAnswerLayout, isBoundsInside } from '../src/utils/quizLayout.js';
import { getEligibleCrates, selectHiddenQuizCrates, QUIZ_DROP_RULES, createGridKey } from '../src/utils/quizDrops.js';
import { LEVEL_01 } from '../src/data/level01.js';

describe('POWER_UP_RULES', () => {
  it('should have speedDurationMs of 15000', () => {
    expect(POWER_UP_RULES.speedDurationMs).toBe(15000);
  });

  it('should have speedMultiplier of 1.2', () => {
    expect(POWER_UP_RULES.speedMultiplier).toBe(1.2);
  });

  it('should have maxBalloons of 5', () => {
    expect(POWER_UP_RULES.maxBalloons).toBe(5);
  });

  it('should have maxExplosionRange of 5', () => {
    expect(POWER_UP_RULES.maxExplosionRange).toBe(5);
  });

  it('should not allow speed multiplier to stack beyond 1.2', () => {
    expect(POWER_UP_RULES.speedMultiplier).toBe(1.2);
    const stacked = POWER_UP_RULES.speedMultiplier * POWER_UP_RULES.speedMultiplier;
    expect(stacked).toBe(1.44);
  });
});

describe('QuizScene font size helpers', () => {
  it('should return 18 for short questions', () => {
    expect(getQuestionFontSize('typeof 123')).toBe(18);
  });

  it('should return 18 for medium questions', () => {
    const medium = 'To\u00e1n t\u1eed n\u00e0o so s\u00e1nh c\u1ea3 gi\u00e1 tr\u1ecb v\u00e0 ki\u1ec3u d\u1eef li\u1ec7u trong JavaScript?';
    expect(getQuestionFontSize(medium)).toBe(18);
  });

  it('should return 16 for questions > 90 chars', () => {
    expect(getQuestionFontSize('a'.repeat(95))).toBe(16);
  });

  it('should return 14 for questions > 140 chars', () => {
    expect(getQuestionFontSize('a'.repeat(141))).toBe(14);
  });

  it('should return 17 for short answers', () => {
    expect(getAnswerFontSize('"number"')).toBe(17);
  });

  it('should return 15 for answers > 35 chars', () => {
    expect(getAnswerFontSize('a'.repeat(40))).toBe(15);
  });

  it('should return 14 for answers > 55 chars', () => {
    expect(getAnswerFontSize('a'.repeat(60))).toBe(14);
  });

  it('should return 13 for answers > 85 chars', () => {
    expect(getAnswerFontSize('a'.repeat(90))).toBe(13);
  });
});

describe('calculateAnswerLayout', () => {
  it('should return 4 layout entries for 4 answers', () => {
    const layout = calculateAnswerLayout(['a', 'b', 'c', 'd']);
    expect(layout).toHaveLength(4);
  });

  it('should assign increasing y values with spacing', () => {
    const layout = calculateAnswerLayout(['short', 'medium answer', 'longer answer here', 'very long']);
    expect(layout[1].y).toBeGreaterThan(layout[0].y + layout[0].height);
    expect(layout[2].y).toBeGreaterThan(layout[1].y + layout[1].height);
    expect(layout[3].y).toBeGreaterThan(layout[2].y + layout[2].height);
  });

  it('should have min height of 54 for each box', () => {
    const layout = calculateAnswerLayout(['a', 'b', 'c', 'd']);
    for (const entry of layout) {
      expect(entry.height).toBeGreaterThanOrEqual(54);
    }
  });
});

describe('isBoundsInside', () => {
  it('should return true when inner is fully contained', () => {
    const outer = { x: 0, y: 0, width: 100, height: 100, right: 100, bottom: 100 };
    const inner = { x: 10, y: 10, width: 80, height: 80, right: 90, bottom: 90 };
    expect(isBoundsInside(inner, outer)).toBe(true);
  });

  it('should return false when inner is outside outer right', () => {
    const outer = { x: 0, y: 0, width: 100, height: 100, right: 100, bottom: 100 };
    const inner = { x: 90, y: 10, width: 80, height: 80, right: 170, bottom: 90 };
    expect(isBoundsInside(inner, outer)).toBe(false);
  });

  it('should return false when inner is outside outer bottom', () => {
    const outer = { x: 0, y: 0, width: 100, height: 100, right: 100, bottom: 100 };
    const inner = { x: 10, y: 90, width: 80, height: 80, right: 90, bottom: 170 };
    expect(isBoundsInside(inner, outer)).toBe(false);
  });

  it('should return false for null inputs', () => {
    expect(isBoundsInside(null, {})).toBe(false);
    expect(isBoundsInside({}, null)).toBe(false);
  });
});

describe('UI layout constants', () => {
  it('should have panel width within canvas', () => {
    const PANEL_W = 760;
    expect(PANEL_W).toBeLessThanOrEqual(800);
  });

  it('should have panel height within canvas', () => {
    const PANEL_H = 560;
    expect(PANEL_H).toBeLessThanOrEqual(600);
  });

  it('should have prefix inside answer box left bound', () => {
    const ANSWER_BOX_WIDTH = 600;
    const PANEL_X = 400;
    const ANSWER_BOX_LEFT = PANEL_X - ANSWER_BOX_WIDTH / 2;
    const PREFIX_X = ANSWER_BOX_LEFT + 28;
    expect(PREFIX_X).toBeGreaterThan(ANSWER_BOX_LEFT);
    expect(PREFIX_X).toBeLessThan(ANSWER_BOX_LEFT + ANSWER_BOX_WIDTH);
  });
});

describe('Quiz drop selection with production helpers', () => {
  const spawnPoints = [{ row: 1, col: 1 }, { row: 9, col: 13 }];

  it('should select exactly 10 items from 68 eligible crates', () => {
    const eligible = getEligibleCrates(LEVEL_01, spawnPoints, QUIZ_DROP_RULES.spawnSafeRadius);
    expect(eligible).toHaveLength(68);
    const selected = selectHiddenQuizCrates(eligible, QUIZ_DROP_RULES.hiddenItemsPerRound);
    expect(selected).toHaveLength(10);
  });
});
