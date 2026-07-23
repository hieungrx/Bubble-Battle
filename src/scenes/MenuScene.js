import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const title = this.add.text(400, 150, 'Bubble Battle:\nCampus Chaos', {
      fontSize: '48px',
      fill: '#00ffff',
      align: 'center',
      fontStyle: 'bold'
    });
    title.setOrigin(0.5);

    const subtitle = this.add.text(400, 240, 'Local Two-Player Game', {
      fontSize: '24px',
      fill: '#aaaaaa'
    });
    subtitle.setOrigin(0.5);

    const p1Help = this.add.text(200, 350, 'Player 1 (Red)\nMove: W, A, S, D\nPlace: SPACE', {
      fontSize: '20px',
      fill: '#ff8888',
      align: 'center'
    });
    p1Help.setOrigin(0.5);

    const p2Help = this.add.text(600, 350, 'Player 2 (Blue)\nMove: Arrows\nPlace: ENTER', {
      fontSize: '20px',
      fill: '#8888ff',
      align: 'center'
    });
    p2Help.setOrigin(0.5);

    const prompt = this.add.text(400, 480, 'Press SPACE to Start', {
      fontSize: '28px',
      fill: '#ffff00'
    });
    prompt.setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.2,
      duration: 600,
      ease: 'Stepped',
      easeParams: [1],
      yoyo: true,
      repeat: -1
    });

    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('GameScene');
    });
  }
}
