import Phaser from 'phaser';
import { GAME_RULES } from '../constants/gameRules.js';

export default class WaterBalloon extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, owner, gridRow, gridCol) {
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x00ffff, 1);
    graphics.fillCircle(14, 14, 14);
    graphics.generateTexture('balloon', 28, 28);
    graphics.destroy();

    super(scene, x, y, 'balloon');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.owner = owner;
    this.gridRow = gridRow;
    this.gridCol = gridCol;

    this.body.setImmovable(true);
    this.body.setSize(32, 32);

    // After setting the balloon, it will explode after balloonFuseDuration
    this.fuseTimer = scene.time.delayedCall(
      GAME_RULES.balloonFuseDuration,
      this.explode,
      [],
      this
    );
  }

  explode() {
    if (!this.active) return;
    
    // Decrease the owner active balloon count exactly once
    if (this.owner && this.owner.activeBalloons > 0) {
      this.owner.activeBalloons--;
    }

    // Emit event for explosion system to handle the blast
    this.scene.events.emit('balloon_explode', {
      row: this.gridRow,
      col: this.gridCol,
      range: this.owner.waterRange
    });

    this.destroy();
  }
}
