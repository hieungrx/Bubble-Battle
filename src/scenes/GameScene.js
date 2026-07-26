import Phaser from 'phaser';
import { LEVEL_01 } from '../data/level01.js';
import { JS_QUESTIONS } from '../data/jsQuestions.js';
import GridMapSystem from '../systems/GridMapSystem.js';
import ExplosionSystem from '../systems/ExplosionSystem.js';
import RoundManager from '../systems/RoundManager.js';
import { GAME_RULES, POWER_UP_RULES } from '../constants/gameRules.js';
import { ROUND_STATE } from '../constants/gameStates.js';
import Player from '../entities/Player.js';
import WaterBalloon from '../entities/WaterBalloon.js';
import QuizItem from '../entities/QuizItem.js';
import { gridToWorld, worldToGrid } from '../utils/grid.js';
import { selectRandomQuestion, validateQuestionBank } from '../utils/quiz.js';
import { POWER_UP_DISPLAY } from '../constants/powerUps.js';
import { getEligibleCrates, createGridKey, selectHiddenQuizCrates, QUIZ_DROP_RULES } from '../utils/quizDrops.js';
import { resetQuizItemIdCounter } from '../entities/QuizItem.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.mapSystem = new GridMapSystem(this, LEVEL_01);
    this.mapSystem.buildMap();

    // Calculate map dimensions dynamically from LEVEL_01 data
    const mapRows = LEVEL_01.length;
    const mapCols = LEVEL_01[0].length;
    const mapWidth = mapCols * GAME_RULES.tileSize;
    const mapHeight = mapRows * GAME_RULES.tileSize;
    
    this.cameras.main.centerOn(mapWidth / 2, mapHeight / 2);
    
    // Prevent default browser behavior for arrow keys and space
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

    // Spawn Player 1 at row 1, col 1
    const p1Spawn = gridToWorld(1, 1, GAME_RULES.tileSize);
    this.player1 = new Player(this, 1, p1Spawn.x, p1Spawn.y);
    this.player1.setControls({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      action: Phaser.Input.Keyboard.KeyCodes.SPACE
    });

    // Spawn Player 2 at row 9, col 13 (opposite corner in level01)
    const p2Spawn = gridToWorld(9, 13, GAME_RULES.tileSize);
    this.player2 = new Player(this, 2, p2Spawn.x, p2Spawn.y);
    this.player2.setControls({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      action: Phaser.Input.Keyboard.KeyCodes.ENTER
    });

    // Balloons group
    this.balloons = this.physics.add.staticGroup();

    // Setup collisions
    this.physics.add.collider(this.player1, this.mapSystem.walls);
    this.physics.add.collider(this.player1, this.mapSystem.crates);
    this.physics.add.collider(this.player2, this.mapSystem.walls);
    this.physics.add.collider(this.player2, this.mapSystem.crates);
    
    // Players collide with each other
    this.physics.add.collider(this.player1, this.player2);

    // Collision with balloons (only solid if player cannot pass)
    this.physics.add.collider(this.player1, this.balloons, null, this.checkBalloonCollision, this);
    this.physics.add.collider(this.player2, this.balloons, null, this.checkBalloonCollision, this);

    // Setup explosion system
    this.explosionSystem = new ExplosionSystem(this, this.mapSystem);
    this.events.on('balloon_explode', this.explosionSystem.handleExplosion, this.explosionSystem);

    // Overlap for explosions vs players to trigger TRAPPED state
    this.physics.add.overlap(this.player1, this.explosionSystem.explosions, this.handlePlayerHit, null, this);
    this.physics.add.overlap(this.player2, this.explosionSystem.explosions, this.handlePlayerHit, null, this);

    // Listen to placement
    this.events.on('request_place_balloon', this.handlePlaceBalloon, this);

    // Start round
    this.roundManager = new RoundManager(this, this.player1, this.player2);
    this.roundManager.start();

    // Quiz system state
    validateQuestionBank(JS_QUESTIONS);
    this.lastQuestionId = null;
    this.quizItemsGroup = this.physics.add.staticGroup();
    this.quizItems = new Map();
    this.activeQuizSession = null;
    this.hiddenQuizCrates = new Set();
    this.revealedQuizCount = 0;
    resetQuizItemIdCounter();

    // Select 10 hidden crates at round start
    const spawnPoints = [{ row: 1, col: 1 }, { row: 9, col: 13 }];
    const eligible = getEligibleCrates(LEVEL_01, spawnPoints);
    const selected = selectHiddenQuizCrates(eligible, QUIZ_DROP_RULES.hiddenItemsPerRound);
    for (const c of selected) {
      this.hiddenQuizCrates.add(createGridKey(c.row, c.col));
    }

    this.events.on('crate_destroyed', this.handleCrateDestroyed, this);
    this.events.on('quiz_answered', this.handleQuizAnswered, this);
    this.events.on('quiz_item_despawned', this.handleQuizItemDespawned, this);

    this.physics.add.overlap(this.player1, this.quizItemsGroup, this.handleQuizItemOverlap, null, this);
    this.physics.add.overlap(this.player2, this.quizItemsGroup, this.handleQuizItemOverlap, null, this);

    // Add HUD
    this.createHUD();
  }

  createHUD() {
    // HUD Header background bar
    const hudBar = this.add.rectangle(400, 18, 800, 36, 0x0f172a, 0.85);
    hudBar.setScrollFactor(0);

    // Player 1 HUD
    this.p1HudText = this.add.text(30, 18, 'P1 [WASD + SPACE]', {
      fontSize: '16px',
      fill: '#ef4444',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setScrollFactor(0);

    // Timer HUD
    this.timeText = this.add.text(400, 18, `TIME: ${GAME_RULES.roundDuration}`, {
      fontSize: '20px',
      fill: '#f59e0b',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0.5).setScrollFactor(0);

    // Player 2 HUD
    this.p2HudText = this.add.text(770, 18, 'P2 [ARROWS + ENTER]', {
      fontSize: '16px',
      fill: '#3b82f6',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setScrollFactor(0);

    // JS Score HUD
    this.p1JsScoreText = this.add.text(30, 42, 'P1 JS: 0', {
      fontSize: '13px',
      fill: '#fbbf24'
    }).setScrollFactor(0);

    this.p2JsScoreText = this.add.text(770, 42, 'P2 JS: 0', {
      fontSize: '13px',
      fill: '#fbbf24'
    }).setOrigin(1, 0).setScrollFactor(0);

    // Power-up HUD
    this.p1BalloonHud = this.add.text(30, 58, `BALLOON: ${GAME_RULES.startingBalloonLimit}/${POWER_UP_RULES.maxBalloons}`, {
      fontSize: '11px',
      fill: '#94a3b8'
    }).setScrollFactor(0);

    this.p1RangeHud = this.add.text(30, 72, `RANGE: ${GAME_RULES.startingWaterRange}/${POWER_UP_RULES.maxExplosionRange}`, {
      fontSize: '11px',
      fill: '#94a3b8'
    }).setScrollFactor(0);

    this.p1SpeedHud = this.add.text(30, 86, 'SPEED: NORMAL', {
      fontSize: '11px',
      fill: '#94a3b8'
    }).setScrollFactor(0);

    this.p2BalloonHud = this.add.text(770, 58, `BALLOON: ${GAME_RULES.startingBalloonLimit}/${POWER_UP_RULES.maxBalloons}`, {
      fontSize: '11px',
      fill: '#94a3b8'
    }).setOrigin(1, 0).setScrollFactor(0);

    this.p2RangeHud = this.add.text(770, 72, `RANGE: ${GAME_RULES.startingWaterRange}/${POWER_UP_RULES.maxExplosionRange}`, {
      fontSize: '11px',
      fill: '#94a3b8'
    }).setOrigin(1, 0).setScrollFactor(0);

    this.p2SpeedHud = this.add.text(770, 86, 'SPEED: NORMAL', {
      fontSize: '11px',
      fill: '#94a3b8'
    }).setOrigin(1, 0).setScrollFactor(0);

    // Notification text
    this.notificationText = this.add.text(400, 560, '', {
      fontSize: '18px',
      fill: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#000000aa',
      padding: { x: 12, y: 6 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);

    this.events.on('timer_tick', this.handleTimerTick, this);
    this.events.on('power_up_granted', this.handlePowerUpGranted, this);
    this.events.on('speed_boost_ended', this.handleSpeedBoostEnded, this);

    this.hudUpdateTimer = this.time.addEvent({
      delay: 1000,
      callback: this.updatePlayerPowerUpHUD,
      callbackScope: this,
      loop: true
    });
  }

  updatePlayerPowerUpHUD(playerId) {
    if (playerId === undefined) {
      this.updatePlayerPowerUpHUD(1);
      this.updatePlayerPowerUpHUD(2);
      return;
    }

    const isP1 = playerId === 1;
    const player = isP1 ? this.player1 : this.player2;
    if (!player) return;

    const balloonHud = isP1 ? this.p1BalloonHud : this.p2BalloonHud;
    const rangeHud = isP1 ? this.p1RangeHud : this.p2RangeHud;
    const speedHud = isP1 ? this.p1SpeedHud : this.p2SpeedHud;

    balloonHud?.setText(`BALLOON: ${player.maxBalloons}/${POWER_UP_RULES.maxBalloons}`);
    rangeHud?.setText(`RANGE: ${player.waterRange}/${POWER_UP_RULES.maxExplosionRange}`);

    if (player.speedBoostActive) {
      const remaining = player.getSpeedBoostRemaining();
      speedHud?.setText(`SPEED: ${remaining}s`);
      speedHud?.setColor('#00ff88');
    } else {
      speedHud?.setText('SPEED: NORMAL');
      speedHud?.setColor('#94a3b8');
    }
  }

  handleTimerTick(timeLeft) {
    this.timeText?.setText(`TIME: ${timeLeft}`);
  }

  handleCrateDestroyed({ row, col, x, y }) {
    if (!this.roundManager || this.roundManager.state !== ROUND_STATE.PLAYING) return;

    const key = createGridKey(row, col);
    if (!this.hiddenQuizCrates.has(key)) return;

    this.hiddenQuizCrates.delete(key);
    this.revealedQuizCount++;

    const quizItem = new QuizItem(this, row, col);
    this.quizItemsGroup.add(quizItem, true);
    quizItem.body.setSize(28, 28);
    quizItem.body.setOffset(-14, -14);
    this.quizItems.set(quizItem.itemId, quizItem);
    this.events.emit('quiz_item_spawned', { row, col });
  }

  handleQuizItemOverlap(player, item) {
    if (
      !player ||
      !item ||
      this.activeQuizSession ||
      !this.roundManager ||
      this.roundManager.state !== ROUND_STATE.PLAYING ||
      !this.quizItems?.has(item.itemId) ||
      item.claimed ||
      item.collected ||
      !item.active
    ) {
      return;
    }

    if (!item.claim(player)) {
      return;
    }

    this.handleQuizItemClaimed(player.id, item);
  }

  handleQuizItemClaimed(playerId, item) {
    if (this.activeQuizSession) return;
    if (!this.quizItems.has(item.itemId)) return;

    const q = selectRandomQuestion(JS_QUESTIONS, this.lastQuestionId);
    if (!q) {
      this.destroyQuizItem(item);
      return;
    }

    this.lastQuestionId = q.id;
    this.activeQuizSession = { itemId: item.itemId, playerId, questionId: q.id };

    const label = playerId === 1 ? 'P1' : 'P2';
    this.showNotification(`${label} CHIEM QUIZ ITEM!`);

    this.scene.launch('QuizScene', { question: q, playerId });
  }

  destroyQuizItem(item) {
    if (!item) return;
    this.quizItems.delete(item.itemId);
    item.destroy();
  }

  handleQuizItemDespawned(quizItem) {
    this.destroyQuizItem(quizItem);
  }

  handleQuizAnswered({ playerId, correct, reward }) {
    if (this.activeQuizSession) {
      const sessionItem = this.quizItems.get(this.activeQuizSession.itemId);
      if (sessionItem) {
        this.destroyQuizItem(sessionItem);
      }
      this.activeQuizSession = null;
    }

    const player = playerId === 1 ? this.player1 : this.player2;
    const label = playerId === 1 ? 'P1' : 'P2';

    if (correct && player) {
      player.jsCorrectCount = (player.jsCorrectCount || 0) + 1;

      if (playerId === 1) {
        this.p1JsScoreText?.setText(`P1 JS: ${player.jsCorrectCount}`);
      } else {
        this.p2JsScoreText?.setText(`P2 JS: ${player.jsCorrectCount}`);
      }

      const display = POWER_UP_DISPLAY[reward];
      const rewardLabel = display ? display.label : reward;
      const floatMsg = display ? display.message : reward;

      switch (reward) {
        case 'speed_boost':
          player.applySpeedBoost();
          break;
        case 'extra_balloon':
          player.increaseMaxBalloons();
          break;
        case 'explosion_range':
          player.increaseExplosionRange();
          break;
      }

      this.updatePlayerPowerUpHUD(playerId);
      this.showNotification(`${label} tra loi dung: ${rewardLabel}`);
      this.showFloatingReward(player, floatMsg);
      this.events.emit('power_up_granted', { playerId, reward });
    } else {
      this.showNotification(`${label} tra loi sai`);
    }
  }

  showFloatingReward(player, message) {
    if (!player) return;
    const txt = this.add.text(player.x, player.y - 20, message, {
      fontSize: '16px',
      fill: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: txt,
      y: txt.y - 40,
      alpha: 0,
      duration: 1800,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (txt && txt.active) txt.destroy();
      }
    });
  }

  handlePowerUpGranted({ playerId, reward }) {
    if (reward === 'speed_boost') {
      this.updatePlayerPowerUpHUD(playerId);
    }
  }

  handleSpeedBoostEnded(player) {
    const playerId = player ? player.id : null;
    if (playerId) {
      this.updatePlayerPowerUpHUD(playerId);
    }
    if (player && player.active) {
      this.showNotification(`P${playerId} SPEED BOOST het han`);
    }
  }

  showNotification(message) {
    if (!this.notificationText) return;
    if (this.notificationTimer) {
      this.notificationTimer.remove(false);
      this.notificationTimer = null;
    }

    this.notificationText.setText(message);
    this.notificationText.setVisible(true);

    this.notificationTimer = this.time.delayedCall(2000, () => {
      if (this.notificationText) {
        this.notificationText.setVisible(false);
      }
      this.notificationTimer = null;
    });
  }

  handlePlayerHit(player, explosion) {
    if (!this.roundManager || this.roundManager.state !== ROUND_STATE.PLAYING) {
      return;
    }
    player.trap();
  }

  checkBalloonCollision(player, balloon) {
    return !balloon.canPlayerPass(player);
  }

  handlePlaceBalloon(player) {
    if (!this.roundManager) {
        return;
    }
    if (this.roundManager.state !== ROUND_STATE.PLAYING) {
        return;
    }
    if (player.activeBalloons >= player.maxBalloons) {
        return;
    }

    const gridPos = worldToGrid(player.x, player.y, GAME_RULES.tileSize);
    const { x, y } = gridToWorld(gridPos.row, gridPos.col, GAME_RULES.tileSize);

    let hasBalloon = false;
    this.balloons.getChildren().forEach((b) => {
      if (b.gridRow === gridPos.row && b.gridCol === gridPos.col) {
        hasBalloon = true;
      }
    });

    if (hasBalloon) {
        return;
    }

    const balloon = new WaterBalloon(this, x, y, player, gridPos.row, gridPos.col);
    this.balloons.add(balloon, true);
    balloon.body.updateFromGameObject();
    player.activeBalloons++;
  }

  update(time, delta) {
    if (!this.roundManager || this.roundManager.state !== ROUND_STATE.PLAYING) {
      if (this.player1) this.player1.setVelocity(0);
      if (this.player2) this.player2.setVelocity(0);
      return;
    }

    this.balloons.getChildren().forEach((balloon) => {
      balloon.updateOwnerPassThrough?.();
    });

    if (this.player1) {
      this.player1.update();
      this.player1.updateSpeedEffect();
    }
    if (this.player2) {
      this.player2.update();
      this.player2.updateSpeedEffect();
    }
  }

  shutdown() {
    this.events.off(
      'balloon_explode',
      this.explosionSystem?.handleExplosion,
      this.explosionSystem
    );

    this.events.off(
      'request_place_balloon',
      this.handlePlaceBalloon,
      this
    );

    this.events.off(
      'timer_tick',
      this.handleTimerTick,
      this
    );

    this.events.off(
      'crate_destroyed',
      this.handleCrateDestroyed,
      this
    );

    this.events.off(
      'quiz_answered',
      this.handleQuizAnswered,
      this
    );

    this.events.off(
      'quiz_item_despawned',
      this.handleQuizItemDespawned,
      this
    );

    this.events.off(
      'power_up_granted',
      this.handlePowerUpGranted,
      this
    );

    this.events.off(
      'speed_boost_ended',
      this.handleSpeedBoostEnded,
      this
    );

    if (this.notificationTimer) {
      this.notificationTimer.remove(false);
      this.notificationTimer = null;
    }

    if (this.hudUpdateTimer) {
      this.hudUpdateTimer.remove(false);
      this.hudUpdateTimer = null;
    }

    if (this.scene.isActive('QuizScene') || this.scene.isVisible('QuizScene')) {
      try { this.scene.stop('QuizScene'); } catch (e) { /* ignore */ }
    }

    if (this.quizItems) {
      for (const item of this.quizItems.values()) {
        try { item.destroy(); } catch (e) { /* ignore */ }
      }
      this.quizItems.clear();
    }

    if (this.quizItemsGroup) {
      try {
        this.quizItemsGroup.clear(true, true);
      } catch (e) { /* ignore */ }
    }

    this.roundManager?.destroy();
    this.explosionSystem?.destroy?.();

    this.player1?.cleanup?.();
    this.player2?.cleanup?.();

    this.roundManager = null;
    this.explosionSystem = null;
    this.player1 = null;
    this.player2 = null;
    this.balloons = null;
    this.mapSystem = null;
    this.quizItems = null;
    this.quizItemsGroup = null;
    this.notificationTimer = null;
    this.activeQuizSession = null;
    this.hiddenQuizCrates = null;
    this.revealedQuizCount = 0;
  }
}
