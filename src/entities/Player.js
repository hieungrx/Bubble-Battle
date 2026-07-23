import Phaser from 'phaser';
import { PLAYER_STATE } from '../constants/gameStates.js';
import { GAME_RULES } from '../constants/gameRules.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, id, x, y, color) {
    // We create a temporary texture using a graphics object to represent the player
    const graphics = scene.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillCircle(16, 16, 16);
    graphics.generateTexture(`player_${id}`, 32, 32);
    graphics.destroy();

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

    this.setCollideWorldBounds(true);
    // Make the hitbox slightly smaller than the tile size so it's easier to walk through corridors
    this.body.setSize(24, 24);
    this.body.setOffset(4, 4);

    this.controls = {};
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
      this.trapTimer.remove();
    }

    // Emit player_dead event for round manager
    this.scene.events.emit('player_dead', this);
  }
}
