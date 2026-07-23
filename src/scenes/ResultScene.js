import Phaser from 'phaser';

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  init(data) {
    this.result = data.result || 'draw';
    this.reason = data.reason || 'timeout';
    this.duration = data.duration || 0;
  }

  create() {
    let resultText = 'It\'s a Draw!';
    if (this.result === 'player1') {
      resultText = 'Player 1 Wins!';
    } else if (this.result === 'player2') {
      resultText = 'Player 2 Wins!';
    }

    const title = this.add.text(400, 200, resultText, {
      fontSize: '48px',
      fill: '#ffffff',
      align: 'center'
    });
    title.setOrigin(0.5);

    const desc = this.add.text(400, 260, `Reason: ${this.reason}\nDuration: ${this.duration}s`, {
      fontSize: '24px',
      fill: '#cccccc',
      align: 'center'
    });
    desc.setOrigin(0.5);

    const prompt = this.add.text(400, 400, 'Press SPACE to Restart', {
      fontSize: '24px',
      fill: '#ffff00',
      align: 'center'
    });
    prompt.setOrigin(0.5);

    // Blinking effect
    this.tweens.add({
      targets: prompt,
      alpha: 0.2,
      duration: 800,
      ease: 'Stepped',
      easeParams: [1],
      yoyo: true,
      repeat: -1
    });

    // Prevent spacebar scrolling
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('GameScene');
    });
  }
}
