import Phaser from 'phaser';
import { POWER_UP_DISPLAY } from '../constants/powerUps.js';

const QUIZ_TIME_LIMIT = 10000;

export default class QuizScene extends Phaser.Scene {
  constructor() {
    super('QuizScene');
  }

  init(data) {
    this.questionData = data.question || null;
    this.playerId = data.playerId || 1;
    this.answered = false;
    this.timerEvent = null;
    this.countdownText = null;
    this.keys = [];
    this.p2SelectedIndex = 0;
    this.p2Markers = [];
  }

  create() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    if (!this.questionData) {
      this.returnResult(false, null);
      return;
    }

    const isP1 = this.playerId === 1;
    const playerLabel = isP1 ? 'P1 (Đỏ)' : 'P2 (Xanh)';
    const playerColor = isP1 ? '#ef4444' : '#3b82f6';

    const bg = this.add.rectangle(400, 300, 700, 420, 0x0f172a, 0.95);
    bg.setStrokeStyle(3, 0xf59e0b);
    bg.setInteractive();

    this.add.text(400, 140, `JavaScript Quiz - ${playerLabel}`, {
      fontSize: '22px',
      fill: playerColor,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(400, 200, this.questionData.question, {
      fontSize: '18px',
      fill: '#ffffff',
      wordWrap: { width: 620 },
      align: 'center'
    }).setOrigin(0.5);

    const answerColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
    const answerLabels = ['A', 'B', 'C', 'D'];

    for (let i = 0; i < 4; i++) {
      const y = 270 + i * 45;
      const btnBg = this.add.rectangle(400, y, 500, 38, 0x1e293b, 0.9);
      btnBg.setStrokeStyle(1, answerColors[i]);

      const prefix = isP1 ? `${i + 1}` : (this.p2SelectedIndex === i ? '>' : ' ');
      const txt = this.add.text(250, y, `${prefix} ${answerLabels[i]}. ${this.questionData.answers[i]}`, {
        fontSize: '17px',
        fill: answerColors[i]
      }).setOrigin(0.5);
      this.p2Markers.push(txt);
    }

    this.add.text(400, 460,
      isP1 ? 'Player 1: Nhan 1, 2, 3, 4 de tra loi'
            : 'Player 2: Dung PHIM LEN/XUONG chon — ENTER xac nhan',
      { fontSize: '14px', fill: '#888888' }
    ).setOrigin(0.5);

    this.countdownText = this.add.text(400, 500, '', {
      fontSize: '20px',
      fill: '#f59e0b',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    if (isP1) {
      this.setupP1Input();
    } else {
      this.setupP2Input();
    }

    this.timeRemaining = QUIZ_TIME_LIMIT;
    this.updateCountdown();

    this.timerEvent = this.time.addEvent({
      delay: 200,
      callback: this.tick,
      callbackScope: this,
      loop: true
    });

    this.scene.pause('GameScene');
  }

  setupP1Input() {
    const key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    const key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    const key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    const key4 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);

    this.keys = [key1, key2, key3, key4];

    key1.once('down', () => this.handleAnswer(0));
    key2.once('down', () => this.handleAnswer(1));
    key3.once('down', () => this.handleAnswer(2));
    key4.once('down', () => this.handleAnswer(3));
  }

  setupP2Input() {
    const upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    const downKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    const enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    this.keys = [upKey, downKey, enterKey];

    upKey.on('down', () => {
      if (this.answered) return;
      this.p2SelectedIndex = Math.max(0, this.p2SelectedIndex - 1);
      this.updateP2Markers();
    });

    downKey.on('down', () => {
      if (this.answered) return;
      this.p2SelectedIndex = Math.min(3, this.p2SelectedIndex + 1);
      this.updateP2Markers();
    });

    enterKey.once('down', () => {
      if (this.answered) return;
      this.handleAnswer(this.p2SelectedIndex);
    });
  }

  updateP2Markers() {
    for (let i = 0; i < 4; i++) {
      const prefix = this.p2SelectedIndex === i ? '>' : ' ';
      const label = ['A', 'B', 'C', 'D'];
      if (this.p2Markers[i]) {
        this.p2Markers[i].setText(`${prefix} ${label[i]}. ${this.questionData.answers[i]}`);
      }
    }
  }

  tick() {
    this.timeRemaining -= 200;
    this.updateCountdown();

    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      if (this.timerEvent) {
        this.timerEvent.remove(false);
        this.timerEvent = null;
      }
      this.handleTimeout();
    }
  }

  updateCountdown() {
    if (this.countdownText) {
      const seconds = Math.max(0, Math.ceil(this.timeRemaining / 1000));
      this.countdownText.setText(`⏱ ${seconds}s`);
    }
  }

  handleAnswer(selectedIndex) {
    if (this.answered) return;
    this.answered = true;

    const correct = selectedIndex === this.questionData.correctIndex;

    this.keys.forEach(k => k.removeAllListeners());
    this.keys = [];

    if (this.timerEvent) {
      this.timerEvent.remove(false);
      this.timerEvent = null;
    }

    this.showResultBanner(correct, this.questionData.reward);

    this.time.delayedCall(1400, () => {
      this.returnResult(correct, this.questionData.reward);
    });
  }

  handleTimeout() {
    if (this.answered) return;
    this.answered = true;

    this.keys.forEach(k => k.removeAllListeners());
    this.keys = [];

    this.showTimeoutBanner();

    this.time.delayedCall(1400, () => {
      this.returnResult(false, null);
    });
  }

  showResultBanner(correct, reward) {
    const playerLabel = this.playerId === 1 ? 'P1' : 'P2';

    if (correct) {
      this.add.text(400, 520, 'CHINH XAC!', {
        fontSize: '36px',
        fill: '#22c55e',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5);

      const display = POWER_UP_DISPLAY[reward];
      const rewardName = display ? display.label : reward;

      this.add.text(400, 555, `${playerLabel} NHAN: ${rewardName}`, {
        fontSize: '22px',
        fill: '#ffd700',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5);
    } else {
      this.add.text(400, 520, 'CHUA CHINH XAC', {
        fontSize: '32px',
        fill: '#ef4444',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5);

      this.add.text(400, 555, 'KHONG NHAN DUOC VAT PHAM', {
        fontSize: '18px',
        fill: '#aaaaaa',
        fontStyle: 'bold'
      }).setOrigin(0.5);
    }
  }

  showTimeoutBanner() {
    this.add.text(400, 520, 'HET GIO', {
      fontSize: '36px',
      fill: '#ef4444',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(400, 555, 'KHONG NHAN DUOC VAT PHAM', {
      fontSize: '18px',
      fill: '#aaaaaa',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  returnResult(correct, reward) {
    const gameScene = this.scene.get('GameScene');
    if (gameScene && this.scene.isPaused('GameScene')) {
      this.scene.resume('GameScene');
      gameScene.events.emit('quiz_answered', {
        playerId: this.playerId,
        correct,
        reward
      });
    }

    this.scene.stop('QuizScene');
  }

  shutdown() {
    if (this.timerEvent) {
      this.timerEvent.remove(false);
      this.timerEvent = null;
    }
    this.keys.forEach(k => {
      try { k.removeAllListeners(); } catch (e) { /* ignore */ }
    });
    this.keys = [];
    this.p2Markers = [];
    this.questionData = null;
  }
}
