import Phaser from 'phaser';
import { POWER_UP_DISPLAY } from '../constants/powerUps.js';

const QUIZ_TIME_LIMIT = 10000;
const PANEL_W = 760;
const PANEL_H = 560;
const PANEL_X = 400;
const PANEL_Y = 300;
const BOUNDS = { left: 20, right: 780, top: 20, bottom: 580 };

function getQuestionFontSize(question) {
  if (question.length > 140) return 14;
  if (question.length > 90) return 16;
  return 18;
}

function getAnswerFontSize(answer) {
  if (answer.length > 85) return 13;
  if (answer.length > 55) return 14;
  if (answer.length > 35) return 15;
  return 17;
}

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
    this.p2Cursor = null;
    this.answerBoxes = [];
    this.resultOverlayElements = [];
  }

  create() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    if (!this.questionData) {
      this.returnResult(false, null);
      return;
    }

    const isP1 = this.playerId === 1;
    const playerLabel = isP1 ? 'P1' : 'P2';
    const playerColor = isP1 ? '#ef4444' : '#3b82f6';

    const bg = this.add.rectangle(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0x0f172a, 0.95);
    bg.setStrokeStyle(3, 0xf59e0b);
    bg.setInteractive();

    this.add.text(PANEL_X, 100, `JavaScript Quiz - ${playerLabel}`, {
      fontSize: '20px',
      fill: playerColor,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const qFontSize = getQuestionFontSize(this.questionData.question);
    this.add.text(PANEL_X, 170, this.questionData.question, {
      fontSize: `${qFontSize}px`,
      fill: '#ffffff',
      wordWrap: { width: 660, useAdvancedWrap: true },
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5);

    const answerColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
    const answerLabels = ['A', 'B', 'C', 'D'];

    const answerStartY = 230;
    const answerSpacing = 6;
    const layoutY = [];

    let currentY = answerStartY;
    for (let i = 0; i < 4; i++) {
      const ansFontSize = getAnswerFontSize(this.questionData.answers[i]);
      const boxHeight = Math.max(54, ansFontSize * 3.5);
      layoutY.push({ y: currentY, height: boxHeight });
      currentY += boxHeight + answerSpacing;
    }

    this.answerBoxes = [];

    for (let i = 0; i < 4; i++) {
      const { y, height } = layoutY[i];
      const ansFontSize = getAnswerFontSize(this.questionData.answers[i]);

      const boxBg = this.add.rectangle(PANEL_X, y + height / 2, 600, height, 0x1e293b, 0.9);
      boxBg.setStrokeStyle(1, answerColors[i]);

      const prefixText = isP1 ? `${i + 1}` : ' ';
      const prefix = this.add.text(BOUNDS.left + 40, y + height / 2, prefixText, {
        fontSize: '16px',
        fill: answerColors[i],
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const label = answerLabels[i];
      const answerText = this.questionData.answers[i];
      const displayText = `${label}. ${answerText}`;

      const ansText = this.add.text(BOUNDS.left + 80, y + height / 2, displayText, {
        fontSize: `${ansFontSize}px`,
        fill: answerColors[i],
        wordWrap: { width: 520, useAdvancedWrap: true },
        lineSpacing: 2
      }).setOrigin(0, 0.5);

      this.answerBoxes.push({ bg: boxBg, prefix, ansText, isP1, y, height, idx: i });
    }

    if (!isP1) {
      this.p2Cursor = this.add.text(this.getCursorX(), this.getCursorY(), '>', {
        fontSize: '20px',
        fill: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      this.updateP2CursorPosition();
    }

    this.add.text(PANEL_X, BOUNDS.bottom - 12,
      isP1 ? 'Player 1: Nhan 1, 2, 3, 4 de tra loi'
            : 'Player 2: Dung PHIM LEN/XUONG chon — ENTER xac nhan',
      { fontSize: '13px', fill: '#888888' }
    ).setOrigin(0.5);

    this.countdownText = this.add.text(PANEL_X, BOUNDS.bottom - 36, '', {
      fontSize: '20px',
      fill: '#f59e0b',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(10);

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

  getCursorX() {
    return BOUNDS.left + 40;
  }

  getCursorY() {
    if (this.answerBoxes.length === 0) return 230 + 27;
    return this.answerBoxes[0].y + this.answerBoxes[0].height / 2;
  }

  updateP2CursorPosition() {
    if (!this.p2Cursor) return;
    const box = this.answerBoxes[this.p2SelectedIndex];
    if (!box) return;
    this.p2Cursor.setPosition(this.getCursorX(), box.y + box.height / 2);
    this.p2Cursor.setDepth(20);
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
      this.updateP2CursorPosition();
    });

    downKey.on('down', () => {
      if (this.answered) return;
      this.p2SelectedIndex = Math.min(3, this.p2SelectedIndex + 1);
      this.updateP2CursorPosition();
    });

    enterKey.once('down', () => {
      if (this.answered) return;
      this.handleAnswer(this.p2SelectedIndex);
    });
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

    this.showResultOverlay(correct, this.questionData.reward);

    this.time.delayedCall(1400, () => {
      this.returnResult(correct, this.questionData.reward);
    });
  }

  handleTimeout() {
    if (this.answered) return;
    this.answered = true;

    this.keys.forEach(k => k.removeAllListeners());
    this.keys = [];

    this.showTimeoutOverlay();

    this.time.delayedCall(1400, () => {
      this.returnResult(false, null);
    });
  }

  showResultOverlay(correct, reward) {
    const playerLabel = this.playerId === 1 ? 'P1' : 'P2';

    // Dim answer area slightly
    for (const box of this.answerBoxes) {
      if (box.bg) box.bg.setAlpha(0.4);
    }

    // Overlay background
    const overlayBg = this.add.rectangle(PANEL_X, PANEL_Y + 20, 500, 140, 0x000000, 0.85);
    overlayBg.setStrokeStyle(2, correct ? '#22c55e' : '#ef4444');
    overlayBg.setDepth(50);
    this.resultOverlayElements.push(overlayBg);

    if (correct) {
      const correctText = this.add.text(PANEL_X, PANEL_Y - 10, 'CHÍNH XÁC!', {
        fontSize: '32px',
        fill: '#22c55e',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(51);
      this.resultOverlayElements.push(correctText);

      const display = POWER_UP_DISPLAY[reward];
      const rewardName = display ? display.label : reward;

      const rewardText = this.add.text(PANEL_X, PANEL_Y + 35, `${playerLabel} NHẬN: ${rewardName}`, {
        fontSize: '20px',
        fill: '#ffd700',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(51);
      this.resultOverlayElements.push(rewardText);
    } else {
      const wrongText = this.add.text(PANEL_X, PANEL_Y - 10, 'CHƯA CHÍNH XÁC', {
        fontSize: '28px',
        fill: '#ef4444',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(51);
      this.resultOverlayElements.push(wrongText);

      const noRewardText = this.add.text(PANEL_X, PANEL_Y + 35, 'KHÔNG NHẬN ĐƯỢC VẬT PHẨM', {
        fontSize: '17px',
        fill: '#aaaaaa',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(51);
      this.resultOverlayElements.push(noRewardText);
    }
  }

  showTimeoutOverlay() {
    for (const box of this.answerBoxes) {
      if (box.bg) box.bg.setAlpha(0.4);
    }

    const overlayBg = this.add.rectangle(PANEL_X, PANEL_Y + 20, 500, 140, 0x000000, 0.85);
    overlayBg.setStrokeStyle(2, '#ef4444');
    overlayBg.setDepth(50);
    this.resultOverlayElements.push(overlayBg);

    const timeoutText = this.add.text(PANEL_X, PANEL_Y - 10, 'HẾT GIỜ', {
      fontSize: '32px',
      fill: '#ef4444',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(51);
    this.resultOverlayElements.push(timeoutText);

    const noRewardText = this.add.text(PANEL_X, PANEL_Y + 35, 'KHÔNG NHẬN ĐƯỢC VẬT PHẨM', {
      fontSize: '17px',
      fill: '#aaaaaa',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(51);
    this.resultOverlayElements.push(noRewardText);
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
    this.answerBoxes = [];
    this.resultOverlayElements = [];
    this.p2Cursor = null;
    this.questionData = null;
  }
}
