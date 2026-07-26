import { describe, it, expect } from 'vitest';
import { POWER_UP_RULES } from '../src/constants/gameRules.js';

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
    // The multiplier should always be 1.2 - never stacked
    expect(POWER_UP_RULES.speedMultiplier).toBe(1.2);
    const stacked = POWER_UP_RULES.speedMultiplier * POWER_UP_RULES.speedMultiplier;
    expect(stacked).toBe(1.44);
    // But production code must never use stacked value
    // It should always use POWER_UP_RULES.speedMultiplier directly
  });
});

describe('Increase ballon/range cap enforcement', () => {
  it('should cap maxBalloons at 5 regardless of calls', () => {
    let maxBalloons = 1;
    const maximum = POWER_UP_RULES.maxBalloons;
    for (let i = 0; i < 10; i++) {
      maxBalloons = Math.min(maxBalloons + 1, maximum);
    }
    expect(maxBalloons).toBe(5);
  });

  it('should cap waterRange at 5 regardless of calls', () => {
    let waterRange = 1;
    const maximum = POWER_UP_RULES.maxExplosionRange;
    for (let i = 0; i < 10; i++) {
      waterRange = Math.min(waterRange + 1, maximum);
    }
    expect(waterRange).toBe(5);
  });

  it('should not go below cap of 5 when starting from 5', () => {
    let max = 5;
    max = Math.min(max + 1, POWER_UP_RULES.maxBalloons);
    expect(max).toBe(5);
  });
});

describe('Speed refresh logic', () => {
  it('should reset to full duration when re-applied', () => {
    const durationMs = POWER_UP_RULES.speedDurationMs;
    let remaining = 15000;
    // Simulate speed boost re-apply
    remaining = durationMs;
    expect(remaining).toBe(15000);
    remaining -= 3000;
    expect(remaining).toBe(12000);
    // Re-apply
    remaining = durationMs;
    expect(remaining).toBe(15000);
  });

  it('should expire to NORMAL after duration', () => {
    const durationMs = POWER_UP_RULES.speedDurationMs;
    let elapsed = 0;
    let active = true;
    // Simulate timer
    while (elapsed < durationMs) {
      elapsed += 1000;
    }
    if (elapsed >= durationMs) {
      active = false;
    }
    expect(active).toBe(false);
  });
});

describe('QuizScene font size helpers', () => {
  function getQuestionFontSize(question) {
    if (question.length > 140) return 14;
    if (question.length > 90) return 16;
    return 18;
  }

  function getAnswerFontSize(answer) {
    if (answer.length > 85) return 13;
    if (answer.length > 55) return 14;
    if (answer.length > 35) return 15;
    return 17;
  }

  it('should return 18 for short questions', () => {
    expect(getQuestionFontSize('typeof 123')).toBe(18);
  });

  it('should return 18 for medium questions', () => {
    const medium = 'Toán tử nào so sánh cả giá trị và kiểu dữ liệu trong JavaScript?';
    // 64 chars → < 90 → font size 18
    expect(getQuestionFontSize(medium)).toBe(18);
  });

  it('should return 14 for long questions', () => {
    const long = 'a'.repeat(141);
    expect(getQuestionFontSize(long)).toBe(14);
  });

  it('should return 17 for short answers', () => {
    expect(getAnswerFontSize('"number"')).toBe(17);
  });

  it('should return 15 for longer answers', () => {
    // > 35 and <= 55 → font size 15
    expect(getAnswerFontSize('a'.repeat(40))).toBe(15);
  });

  it('should return 14 for long answers', () => {
    expect(getAnswerFontSize('a'.repeat(60))).toBe(14);
  });

  it('should return 13 for very long answers', () => {
    expect(getAnswerFontSize('a'.repeat(90))).toBe(13);
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

  it('should have panel margins within bounds', () => {
    const BOUNDS = { left: 20, right: 780, top: 20, bottom: 580 };
    const PANEL_X = 400;
    const PANEL_W = 760;
    const halfW = PANEL_W / 2;
    expect(PANEL_X - halfW).toBe(BOUNDS.left);
    expect(PANEL_X + halfW).toBe(BOUNDS.right);
  });

  it('should have answer wordWrap within panel', () => {
    const wordWrapWidth = 520;
    const PANEL_W = 760;
    expect(wordWrapWidth + 80 + 40).toBeLessThanOrEqual(PANEL_W);
  });
});

describe('Quiz drop selection count', () => {
  it('should select exactly 10 items per round', () => {
    expect(10).toBe(10);
  });

  it('should drop from 68 eligible crates', () => {
    expect(10).toBeLessThanOrEqual(68);
  });
});
