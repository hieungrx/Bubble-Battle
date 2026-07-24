import Phaser from 'phaser';
import { LEVEL_01 } from '../data/level01.js';
import GridMapSystem from '../systems/GridMapSystem.js';
import ExplosionSystem from '../systems/ExplosionSystem.js';
import RoundManager from '../systems/RoundManager.js';
import { GAME_RULES } from '../constants/gameRules.js';
import { ROUND_STATE } from '../constants/gameStates.js';
import Player from '../entities/Player.js';
import WaterBalloon from '../entities/WaterBalloon.js';
import { gridToWorld, worldToGrid } from '../utils/grid.js';

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

    this.events.on('timer_tick', this.handleTimerTick, this);
  }

  handleTimerTick(timeLeft) {
    this.timeText?.setText(`TIME: ${timeLeft}`);
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

    if (this.player1) this.player1.update();
    if (this.player2) this.player2.update();
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
  }
}
