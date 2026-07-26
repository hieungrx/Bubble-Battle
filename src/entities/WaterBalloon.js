import Phaser from 'phaser';
import { GAME_RULES } from '../constants/gameRules.js';

export default class WaterBalloon extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, owner, gridRow, gridCol) {
    super(scene, x, y, 'balloon');
    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.owner = owner;
    this.gridRow = gridRow;
    this.gridCol = gridCol;

    this.passThroughPlayerIds = new Set(owner ? [owner.id] : []);
    this.hasExploded = false;
    this.range = owner ? owner.waterRange : GAME_RULES.startingWaterRange;

    this.body.setSize(32, 32);
    this.body.updateFromGameObject();

    // After setting the balloon, it will explode after balloonFuseDuration
    this.fuseTimer = scene.time.delayedCall(
      GAME_RULES.balloonFuseDuration,
      this.explode,
      [],
      this
    );
  }

  canPlayerPass(player) {
    return this.passThroughPlayerIds.has(player.id);
  }

  updateOwnerPassThrough() {
    if (!this.owner || !this.passThroughPlayerIds.has(this.owner.id)) {
      return;
    }

    const stillOverlapping = this.scene.physics.overlap(this.owner, this);

    if (!stillOverlapping) {
      this.passThroughPlayerIds.delete(this.owner.id);
    }
  }

  explode() {
    if (!this.active || this.hasExploded) return;
    this.hasExploded = true;

    if (this.fuseTimer) {
      this.fuseTimer.remove(false);
      this.fuseTimer = null;
    }

    // Decrease the owner active balloon count exactly once
    if (this.owner && this.owner.activeBalloons > 0) {
      this.owner.activeBalloons--;
    }

    // Emit event for explosion system to handle the blast
    this.scene.events.emit('balloon_explode', {
      row: this.gridRow,
      col: this.gridCol,
      range: this.range
    });

    this.destroy();
  }

  preDestroy() {
    if (this.fuseTimer) {
      this.fuseTimer.remove(false);
      this.fuseTimer = null;
    }
    if (super.preDestroy) {
      super.preDestroy();
    }
  }
}
