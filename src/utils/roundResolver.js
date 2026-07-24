import { PLAYER_STATE } from '../constants/gameStates.js';

export function resolvePlayerStates(p1State, p2State, isTimeout = false) {
  const validStates = Object.values(PLAYER_STATE);
  if (p1State && !validStates.includes(p1State)) {
    throw new TypeError(`Invalid p1State: ${p1State}`);
  }
  if (p2State && !validStates.includes(p2State)) {
    throw new TypeError(`Invalid p2State: ${p2State}`);
  }

  const p1Dead = p1State === PLAYER_STATE.DEAD;
  const p2Dead = p2State === PLAYER_STATE.DEAD;
  const p1Trapped = p1State === PLAYER_STATE.TRAPPED;
  const p2Trapped = p2State === PLAYER_STATE.TRAPPED;
  const p1Active = p1State === PLAYER_STATE.ACTIVE;
  const p2Active = p2State === PLAYER_STATE.ACTIVE;

  if (p1Dead && p2Active) {
    return 'player2';
  }
  if (p1Active && p2Dead) {
    return 'player1';
  }
  if (p1Dead && p2Trapped) {
    return 'draw';
  }
  if (p1Trapped && p2Dead) {
    return 'draw';
  }
  if (p1Dead && p2Dead) {
    return 'draw';
  }
  if (p1Trapped && p2Trapped) {
    return 'draw';
  }
  if (isTimeout) {
    return 'draw';
  }

  return 'draw';
}
