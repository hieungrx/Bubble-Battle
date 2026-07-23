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
      // Red Player body with white outline
      graphics.fillStyle(0xef4444, 1);
      graphics.fillCircle(16, 16, 15);
      graphics.lineStyle(2, 0xffffff, 1);
      graphics.strokeCircle(16, 16, 15);
      // Eye indicators
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(11, 12, 3);
      graphics.fillCircle(21, 12, 3);
      graphics.fillStyle(0x000000, 1);
      graphics.fillCircle(11, 12, 1.5);
      graphics.fillCircle(21, 12, 1.5);
      graphics.generateTexture('player_1', 32, 32);
      graphics.destroy();
    }

    if (!this.textures.exists('player_2')) {
      const graphics = this.add.graphics();
      // Blue Player body with white outline
      graphics.fillStyle(0x3b82f6, 1);
      graphics.fillCircle(16, 16, 15);
      graphics.lineStyle(2, 0xffffff, 1);
      graphics.strokeCircle(16, 16, 15);
      // Eye indicators
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(11, 12, 3);
      graphics.fillCircle(21, 12, 3);
      graphics.fillStyle(0x000000, 1);
      graphics.fillCircle(11, 12, 1.5);
      graphics.fillCircle(21, 12, 1.5);
      graphics.generateTexture('player_2', 32, 32);
      graphics.destroy();
    }

    if (!this.textures.exists('balloon')) {
      const graphics = this.add.graphics();
      // Cyan Water Balloon with shiny highlight
      graphics.fillStyle(0x06b6d4, 1);
      graphics.fillCircle(14, 14, 13);
      graphics.lineStyle(2, 0x0891b2, 1);
      graphics.strokeCircle(14, 14, 13);
      graphics.fillStyle(0xffffff, 0.8);
      graphics.fillCircle(10, 10, 3);
      graphics.generateTexture('balloon', 28, 28);
      graphics.destroy();
    }
  }

  create() {
    this.createPlaceholderTextures();
    this.scene.start('MenuScene');
  }
}
