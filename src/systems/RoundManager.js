import { ROUND_STATE, PLAYER_STATE } from '../constants/gameStates.js';
import { GAME_RULES } from '../constants/gameRules.js';

export default class RoundManager {
  constructor(scene, p1, p2) {
    this.scene = scene;
    this.p1 = p1;
    this.p2 = p2;
    this.state = ROUND_STATE.READY;
    this.timeRemaining = GAME_RULES.roundDuration;
    
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
    
    // UI update could go here or scene can poll this.timeRemaining
    this.scene.events.emit('timer_tick', this.timeRemaining);

    if (this.timeRemaining <= 0) {
      this.handleTimeout();
    }
  }

  handlePlayerDead(player) {
    if (this.state !== ROUND_STATE.PLAYING) return;

    // We can have a small delay to see if the other player also dies in the same explosion
    this.scene.time.delayedCall(100, () => {
      this.resolveRound();
    });
  }

  handleTimeout() {
    this.resolveRound(true);
  }

  resolveRound(isTimeout = false) {
    if (this.state !== ROUND_STATE.PLAYING) return;
    this.state = ROUND_STATE.FINISHED;
    if (this.timer) this.timer.remove();

    const p1Dead = this.p1.state === PLAYER_STATE.DEAD;
    const p2Dead = this.p2.state === PLAYER_STATE.DEAD;

    let result = 'draw';
    let reason = isTimeout ? 'timeout' : 'elimination';

    if (p1Dead && p2Dead) {
      result = 'draw';
    } else if (p1Dead) {
      result = 'player2';
    } else if (p2Dead) {
      result = 'player1';
    } else if (isTimeout) {
      result = 'draw';
    }

    // Wait a bit then transition to result scene
    this.scene.time.delayedCall(2000, () => {
      this.scene.scene.start('ResultScene', {
        result,
        reason,
        duration: GAME_RULES.roundDuration - this.timeRemaining
      });
    });
  }
}
