export function getQuestionFontSize(question) {
  if (question.length > 140) return 14;
  if (question.length > 90) return 16;
  return 18;
}

export function getAnswerFontSize(answer) {
  if (answer.length > 85) return 13;
  if (answer.length > 55) return 14;
  if (answer.length > 35) return 15;
  return 17;
}

export function calculateAnswerLayout(answers, startY = 230, spacing = 6) {
  const layout = [];
  let currentY = startY;

  for (let i = 0; i < answers.length; i++) {
    const fontSize = getAnswerFontSize(answers[i]);
    const boxHeight = Math.max(54, fontSize * 3.5);
    layout.push({ y: currentY, height: boxHeight });
    currentY += boxHeight + spacing;
  }

  return layout;
}

export function isBoundsInside(inner, outer, margin = 0) {
  if (!inner || !outer) return false;

  const outerL = outer.left ?? outer.x ?? 0;
  const outerT = outer.top ?? outer.y ?? 0;
  const outerR = outer.right ?? ((outer.x ?? 0) + (outer.width ?? 0));
  const outerB = outer.bottom ?? ((outer.y ?? 0) + (outer.height ?? 0));

  const innerL = inner.left ?? inner.x ?? 0;
  const innerT = inner.top ?? inner.y ?? 0;
  const innerR = inner.right ?? ((inner.x ?? 0) + (inner.width ?? 0));
  const innerB = inner.bottom ?? ((inner.y ?? 0) + (inner.height ?? 0));

  return (
    innerL >= outerL - margin &&
    innerT >= outerT - margin &&
    innerR <= outerR + margin &&
    innerB <= outerB + margin
  );
}
