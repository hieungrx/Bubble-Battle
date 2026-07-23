import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Load placeholder assets or UI elements if needed
  }

  create() {
    this.scene.start('MenuScene');
  }
}
