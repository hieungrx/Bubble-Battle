import Phaser from 'phaser';
import { PLAYER_STATE } from '../constants/gameStates.js';
import { GAME_RULES } from '../constants/gameRules.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, id, x, y) {
    super(scene, x, y, `player_${id}`);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.id = id;
    this.state = PLAYER_STATE.ACTIVE;
    this.speed = GAME_RULES.startingSpeed;
    this.maxBalloons = GAME_RULES.startingBalloonLimit;
    this.activeBalloons = 0;
    this.waterRange = GAME_RULES.startingWaterRange;
    this.spawnPosition = { x, y };
    this.jsCorrectCount = 0;

    this.setCollideWorldBounds(true);
    // Make the hitbox slightly smaller than the tile size so it's easier to walk through corridors
    this.body.setSize(24, 24);
    this.body.setOffset(4, 4);

    this.controls = {};
    this.trapTimer = null;
    this.speedBoostTimer = null;
    this.speedBoostActive = false;
    this.speedBoostEndTime = 0;
    this.baseSpeed = GAME_RULES.startingSpeed;
    this.speedIndicator = null;
  }

  setControls(keys) {
    this.controls = this.scene.input.keyboard.addKeys(keys);
  }

  update() {
    if (this.state !== PLAYER_STATE.ACTIVE) {
      this.setVelocity(0);
      return;
    }

    let vx = 0;
    let vy = 0;

    if (this.controls.left.isDown) {
      vx = -this.speed;
    } else if (this.controls.right.isDown) {
      vx = this.speed;
    }

    if (this.controls.up.isDown) {
      vy = -this.speed;
    } else if (this.controls.down.isDown) {
      vy = this.speed;
    }

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      const length = Math.sqrt(vx * vx + vy * vy);
      vx = (vx / length) * this.speed;
      vy = (vy / length) * this.speed;
    }

    this.setVelocity(vx, vy);

    if (Phaser.Input.Keyboard.JustDown(this.controls.action)) {
      this.scene.events.emit('request_place_balloon', this);
    }
  }

  trap() {
    if (this.state !== PLAYER_STATE.ACTIVE) return;
    
    this.state = PLAYER_STATE.TRAPPED;
    this.setVelocity(0);
    this.setTint(0x00ffff); // Visual feedback for trapped

    this.trapTimer = this.scene.time.delayedCall(
      GAME_RULES.trappedDuration,
      this.die,
      [],
      this
    );
  }

  die() {
    if (this.state === PLAYER_STATE.DEAD) return;

    this.state = PLAYER_STATE.DEAD;
    this.setVisible(false);
    this.body.setEnable(false);

    if (this.trapTimer) {
      this.trapTimer.remove(false);
      this.trapTimer = null;
    }

    // Emit player_dead event for round manager
    this.scene.events.emit('player_dead', this);
  }

  applySpeedBoost(multiplier = 1.2, durationMs = 10000) {
    if (this.speedBoostTimer) {
      this.speedBoostTimer.remove(false);
      this.speedBoostTimer = null;
    }

    this.speed = Math.round(this.baseSpeed * multiplier);
    this.speedBoostActive = true;
    this.speedBoostEndTime = Date.now() + durationMs;
    this.showSpeedEffect();

    this.speedBoostTimer = this.scene.time.delayedCall(durationMs, () => {
      this.speed = this.baseSpeed;
      this.speedBoostActive = false;
      this.speedBoostEndTime = 0;
      this.speedBoostTimer = null;
      this.hideSpeedEffect();
      this.scene.events.emit('speed_boost_ended', this);
    });
  }

  getSpeedBoostRemaining() {
    if (!this.speedBoostActive) return 0;
    return Math.max(0, Math.ceil((this.speedBoostEndTime - Date.now()) / 1000));
  }

  showSpeedEffect() {
    if (this.speedIndicator) return;
    const g = this.scene.add.graphics();
    g.lineStyle(2, 0x00ff88, 0.7);
    g.strokeCircle(0, 0, 14);
    g.setDepth(this.depth + 1);
    this.speedIndicator = g;
  }

  hideSpeedEffect() {
    if (this.speedIndicator) {
      this.speedIndicator.destroy();
      this.speedIndicator = null;
    }
  }

  updateSpeedEffect() {
    if (!this.speedIndicator) return;
    this.speedIndicator.setPosition(this.x, this.y);
  }

  increaseMaxBalloons(amount = 1, maximum = 3) {
    this.maxBalloons = Math.min(this.maxBalloons + amount, maximum);
  }

  increaseExplosionRange(amount = 1, maximum = 3) {
    this.waterRange = Math.min(this.waterRange + amount, maximum);
  }

  cleanup() {
    if (this.trapTimer) {
      this.trapTimer.remove(false);
      this.trapTimer = null;
    }
    if (this.speedBoostTimer) {
      this.speedBoostTimer.remove(false);
      this.speedBoostTimer = null;
    }
    this.hideSpeedEffect();
  }
}
