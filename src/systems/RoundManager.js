import { ROUND_STATE, PLAYER_STATE } from '../constants/gameStates.js';
import { GAME_RULES } from '../constants/gameRules.js';
import { resolvePlayerStates } from '../utils/roundResolver.js';

export default class RoundManager {
  constructor(scene, p1, p2) {
    this.scene = scene;
    this.p1 = p1;
    this.p2 = p2;
    this.state = ROUND_STATE.READY;
    this.timeRemaining = GAME_RULES.roundDuration;

    this.timer = null;
    this.pendingResolveTimer = null;
    this.resultTransitionTimer = null;
    
    // Listen for dead events
    this.scene.events.on('player_dead', this.handlePlayerDead, this);
  }

  start() {
    this.state = ROUND_STATE.PLAYING;
    this.timer = this.scene.time.addEvent({
      delay: 1000,
      callback: this.tick,
      callbackScope: this,
      loop: true
    });
  }

  tick() {
    if (this.state !== ROUND_STATE.PLAYING) return;
    
    this.timeRemaining--;
    
    this.scene.events.emit('timer_tick', this.timeRemaining);

    if (this.timeRemaining <= 0) {
      this.handleTimeout();
    }
  }

  handlePlayerDead(player) {
    if (this.state !== ROUND_STATE.PLAYING) return;

    if (this.pendingResolveTimer) return;

    // We can have a small delay to see if the other player also dies in the same explosion
    this.pendingResolveTimer = this.scene.time.delayedCall(100, () => {
      this.resolveRound();
    });
  }

  handleTimeout() {
    this.resolveRound(true);
  }

  resolveRound(isTimeout = false) {
    if (this.state !== ROUND_STATE.PLAYING) return;
    this.state = ROUND_STATE.FINISHED;

    if (this.timer) {
      this.timer.remove(false);
      this.timer = null;
    }

    if (this.p1) this.p1.setVelocity(0);
    if (this.p2) this.p2.setVelocity(0);
    this.scene.events.emit('round_finished');

    const result = resolvePlayerStates(this.p1 ? this.p1.state : null, this.p2 ? this.p2.state : null, isTimeout);
    this.lastResolvedResult = result;
    const reason = isTimeout ? 'timeout' : 'elimination';

    // Wait a bit then transition to result scene
    this.resultTransitionTimer = this.scene.time.delayedCall(2000, () => {
      this.scene.scene.start('ResultScene', {
        result,
        reason,
        duration: GAME_RULES.roundDuration - this.timeRemaining,
        p1JsCorrect: this.p1 ? (this.p1.jsCorrectCount || 0) : 0,
        p2JsCorrect: this.p2 ? (this.p2.jsCorrectCount || 0) : 0
      });
    });
  }

  destroy() {
    this.timer?.remove(false);
    this.pendingResolveTimer?.remove(false);
    this.resultTransitionTimer?.remove(false);

    this.scene.events.off('player_dead', this.handlePlayerDead, this);

    this.timer = null;
    this.pendingResolveTimer = null;
    this.resultTransitionTimer = null;
  }
}
