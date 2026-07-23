import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Load placeholder assets or UI elements if needed
  }

  createPlaceholderTextures() {
    if (!this.textures.exists('player_1')) {
      const graphics = this.add.graphics();
      graphics.fillStyle(0xff0000, 1);
      graphics.fillCircle(16, 16, 16);
      graphics.generateTexture('player_1', 32, 32);
      graphics.destroy();
    }

    if (!this.textures.exists('player_2')) {
      const graphics = this.add.graphics();
      graphics.fillStyle(0x0000ff, 1);
      graphics.fillCircle(16, 16, 16);
      graphics.generateTexture('player_2', 32, 32);
      graphics.destroy();
    }

    if (!this.textures.exists('balloon')) {
      const graphics = this.add.graphics();
      graphics.fillStyle(0x00ffff, 1);
      graphics.fillCircle(14, 14, 14);
      graphics.generateTexture('balloon', 28, 28);
      graphics.destroy();
    }
  }

  create() {
    this.createPlaceholderTextures();
    this.scene.start('MenuScene');
  }
}
