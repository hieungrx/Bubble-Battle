export function validateQuestionBank(questions) {
  if (!Array.isArray(questions)) {
    throw new TypeError('Question bank must be an array');
  }
  if (questions.length !== 10) {
    throw new Error(`Question bank must have exactly 10 questions, got ${questions.length}`);
  }

  const ids = new Set();
  const validRewards = new Set(['speed_boost', 'extra_balloon', 'explosion_range']);

  for (const q of questions) {
    if (!q.id || typeof q.id !== 'string') {
      throw new Error(`Question is missing valid id: ${JSON.stringify(q)}`);
    }
    if (ids.has(q.id)) {
      throw new Error(`Duplicate question id: ${q.id}`);
    }
    ids.add(q.id);

    if (!Array.isArray(q.answers) || q.answers.length !== 4) {
      throw new Error(`Question ${q.id} must have exactly 4 answers`);
    }

    if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= 4) {
      throw new Error(`Question ${q.id} has invalid correctIndex: ${q.correctIndex}`);
    }

    if (!validRewards.has(q.reward)) {
      throw new Error(`Question ${q.id} has invalid reward: ${q.reward}`);
    }
  }

  return true;
}

export function selectRandomQuestion(questions, previousQuestionId) {
  if (questions.length === 0) {
    return null;
  }

  if (previousQuestionId === null || previousQuestionId === undefined || questions.length === 1) {
    const index = Math.floor(Math.random() * questions.length);
    return questions[index];
  }

  const candidates = [];
  for (const q of questions) {
    if (q.id !== previousQuestionId) {
      candidates.push(q);
    }
  }

  if (candidates.length === 0) {
    const index = Math.floor(Math.random() * questions.length);
    return questions[index];
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

export function isCorrectAnswer(question, selectedIndex) {
  return question.correctIndex === selectedIndex;
}
