import { describe, it, expect } from 'vitest';
import { resolvePlayerStates } from '../src/utils/roundResolver.js';
import { PLAYER_STATE } from '../src/constants/gameStates.js';

describe('resolvePlayerStates', () => {
  it('should return player2 when p1 is DEAD and p2 is ACTIVE', () => {
    const result = resolvePlayerStates(PLAYER_STATE.DEAD, PLAYER_STATE.ACTIVE);
    expect(result).toBe('player2');
  });

  it('should return player1 when p1 is ACTIVE and p2 is DEAD', () => {
    const result = resolvePlayerStates(PLAYER_STATE.ACTIVE, PLAYER_STATE.DEAD);
    expect(result).toBe('player1');
  });

  it('should return draw when both players are DEAD', () => {
    const result = resolvePlayerStates(PLAYER_STATE.DEAD, PLAYER_STATE.DEAD);
    expect(result).toBe('draw');
  });

  it('should return draw when p1 is DEAD and p2 is TRAPPED', () => {
    const result = resolvePlayerStates(PLAYER_STATE.DEAD, PLAYER_STATE.TRAPPED);
    expect(result).toBe('draw');
  });

  it('should return draw when p1 is TRAPPED and p2 is DEAD', () => {
    const result = resolvePlayerStates(PLAYER_STATE.TRAPPED, PLAYER_STATE.DEAD);
    expect(result).toBe('draw');
  });

  it('should return draw when both players are ACTIVE on timeout', () => {
    const result = resolvePlayerStates(PLAYER_STATE.ACTIVE, PLAYER_STATE.ACTIVE, true);
    expect(result).toBe('draw');
  });
});
