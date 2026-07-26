import { describe, it, expect } from 'vitest';
import { JS_QUESTIONS } from '../src/data/jsQuestions.js';
import { selectRandomQuestion, isCorrectAnswer, validateQuestionBank } from '../src/utils/quiz.js';

describe('JavaScript Question Bank', () => {
  it('should have exactly 10 questions', () => {
    expect(JS_QUESTIONS.length).toBe(10);
  });

  it('should have all unique IDs', () => {
    const ids = JS_QUESTIONS.map(q => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);
  });

  it('should have exactly 4 answers per question', () => {
    for (const q of JS_QUESTIONS) {
      expect(Array.isArray(q.answers)).toBe(true);
      expect(q.answers.length, `Question ${q.id} must have 4 answers`).toBe(4);
    }
  });

  it('should have valid correctIndex for every question', () => {
    for (const q of JS_QUESTIONS) {
      expect(typeof q.correctIndex, `Question ${q.id} correctIndex must be a number`).toBe('number');
      expect(q.correctIndex, `Question ${q.id} correctIndex out of range`).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex, `Question ${q.id} correctIndex out of range`).toBeLessThan(4);
    }
  });

  it('should have valid reward for every question', () => {
    const validRewards = ['speed_boost', 'extra_balloon', 'explosion_range'];
    for (const q of JS_QUESTIONS) {
      expect(validRewards, `Question ${q.id} has invalid reward: ${q.reward}`).toContain(q.reward);
    }
  });
});

describe('validateQuestionBank', () => {
  it('should return true for valid question bank', () => {
    expect(validateQuestionBank(JS_QUESTIONS)).toBe(true);
  });

  it('should throw for non-array input', () => {
    expect(() => validateQuestionBank(null)).toThrow(TypeError);
    expect(() => validateQuestionBank('not-array')).toThrow(TypeError);
  });

  it('should throw for wrong question count', () => {
    expect(() => validateQuestionBank([{ id: 'a', question: '?', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' }]))
      .toThrow(/exactly 10/);
  });

  it('should throw for duplicate IDs', () => {
    const dupes = [
      { id: 'q1', question: 'Q1', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q1', question: 'Q2', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q3', question: 'Q3', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q4', question: 'Q4', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q5', question: 'Q5', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q6', question: 'Q6', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q7', question: 'Q7', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q8', question: 'Q8', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q9', question: 'Q9', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q10', question: 'Q10', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
    ];
    expect(() => validateQuestionBank(dupes)).toThrow(/Duplicate/);
  });

  it('should throw for invalid correctIndex', () => {
    const bad = [
      { id: 'q1', question: 'Q1', answers: ['a', 'b', 'c', 'd'], correctIndex: 5, reward: 'speed_boost' },
      { id: 'q2', question: 'Q2', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q3', question: 'Q3', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q4', question: 'Q4', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q5', question: 'Q5', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q6', question: 'Q6', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q7', question: 'Q7', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q8', question: 'Q8', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q9', question: 'Q9', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q10', question: 'Q10', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
    ];
    expect(() => validateQuestionBank(bad)).toThrow(/invalid correctIndex/);
  });

  it('should throw for invalid reward', () => {
    const bad = [
      { id: 'q1', question: 'Q1', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'invincible' },
      { id: 'q2', question: 'Q2', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q3', question: 'Q3', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q4', question: 'Q4', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q5', question: 'Q5', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q6', question: 'Q6', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q7', question: 'Q7', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q8', question: 'Q8', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q9', question: 'Q9', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
      { id: 'q10', question: 'Q10', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, reward: 'speed_boost' },
    ];
    expect(() => validateQuestionBank(bad)).toThrow(/invalid reward/);
  });
});

describe('isCorrectAnswer', () => {
  it('should return true for correct answer', () => {
    const q = { correctIndex: 2 };
    expect(isCorrectAnswer(q, 2)).toBe(true);
  });

  it('should return false for wrong answer', () => {
    const q = { correctIndex: 2 };
    expect(isCorrectAnswer(q, 0)).toBe(false);
    expect(isCorrectAnswer(q, 1)).toBe(false);
    expect(isCorrectAnswer(q, 3)).toBe(false);
  });
});

describe('selectRandomQuestion', () => {
  it('should return a question from the bank', () => {
    const q = selectRandomQuestion(JS_QUESTIONS, null);
    expect(q).toBeDefined();
    expect(JS_QUESTIONS).toContain(q);
  });

  it('should not mutate the original array', () => {
    const originalLen = JS_QUESTIONS.length;
    const copy = [...JS_QUESTIONS];
    selectRandomQuestion(JS_QUESTIONS, 'js-01');
    expect(JS_QUESTIONS.length).toBe(originalLen);
    expect(JS_QUESTIONS).toEqual(copy);
  });

  it('should not return the same question as previous when other options exist', () => {
    // Run multiple times to statistically verify
    let hitSame = false;
    for (let i = 0; i < 100; i++) {
      const result = selectRandomQuestion(JS_QUESTIONS, 'js-01');
      if (result.id === 'js-01' && JS_QUESTIONS.length > 1) {
        hitSame = true;
        break;
      }
    }
    // With 10 questions, randomly hitting the same one 100 times is extremely unlikely
    // But it IS possible if our test bank is only 1 question long
    // With 10 questions, the function picks from 9 candidates, so the excluded one should never be picked
    expect(hitSame).toBe(false);
  });

  it('should handle empty array', () => {
    expect(selectRandomQuestion([], null)).toBeNull();
  });

  it('should handle single-question array', () => {
    const q = selectRandomQuestion([JS_QUESTIONS[0]], JS_QUESTIONS[0].id);
    expect(q).toBe(JS_QUESTIONS[0]);
  });
});
