import Phaser from 'phaser';
import { LEVEL_01 } from '../data/level01.js';
import GridMapSystem from '../systems/GridMapSystem.js';
import ExplosionSystem from '../systems/ExplosionSystem.js';
import RoundManager from '../systems/RoundManager.js';
import { GAME_RULES } from '../constants/gameRules.js';
import Player from '../entities/Player.js';
import WaterBalloon from '../entities/WaterBalloon.js';
import { gridToWorld, worldToGrid } from '../utils/grid.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.mapSystem = new GridMapSystem(this, LEVEL_01);
    this.mapSystem.buildMap();

    // Center the camera on the map (15 cols x 11 rows)
    const mapWidth = 15 * GAME_RULES.tileSize;
    const mapHeight = 11 * GAME_RULES.tileSize;
    
    this.cameras.main.centerOn(mapWidth / 2, mapHeight / 2);
    
    // Prevent default browser behavior for arrow keys and space
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

    // Spawn Player 1 at row 1, col 1
    const p1Spawn = gridToWorld(1, 1, GAME_RULES.tileSize);
    this.player1 = new Player(this, 1, p1Spawn.x, p1Spawn.y, 0xff0000); // Red
    this.player1.setControls({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      action: Phaser.Input.Keyboard.KeyCodes.SPACE
    });

    // Spawn Player 2 at row 9, col 13 (opposite corner in level01)
    const p2Spawn = gridToWorld(9, 13, GAME_RULES.tileSize);
    this.player2 = new Player(this, 2, p2Spawn.x, p2Spawn.y, 0x0000ff); // Blue
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

    // Collision with balloons (only solid if they don't overlap)
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
    this.timeText = this.add.text(400, 20, `Time: ${GAME_RULES.roundDuration}`, {
      fontSize: '24px',
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0);

    this.events.on('timer_tick', (timeLeft) => {
      this.timeText.setText(`Time: ${timeLeft}`);
    });
  }

  handlePlayerHit(player, explosion) {
    player.trap();
  }

  checkBalloonCollision(player, balloon) {
    // If the player bounds still overlap with the balloon bounds from the center, 
    // it means they haven't left it yet, so no collision.
    // We can check simple distance or overlap.
    const dist = Phaser.Math.Distance.Between(player.x, player.y, balloon.x, balloon.y);
    if (dist < GAME_RULES.tileSize * 0.75) {
      return false; // don't collide
    }
    return true; // collide
  }

  handlePlaceBalloon(player) {
    if (player.activeBalloons >= player.maxBalloons) return;

    const gridPos = worldToGrid(player.x, player.y, GAME_RULES.tileSize);
    const { x, y } = gridToWorld(gridPos.row, gridPos.col, GAME_RULES.tileSize);

    // Check if another balloon is already here
    let hasBalloon = false;
    this.balloons.getChildren().forEach((b) => {
      if (b.gridRow === gridPos.row && b.gridCol === gridPos.col) {
        hasBalloon = true;
      }
    });

    if (hasBalloon) return;

    // We shouldn't place inside walls or crates, but player can't walk there anyway.
    
    const balloon = new WaterBalloon(this, x, y, player, gridPos.row, gridPos.col);
    this.balloons.add(balloon);
    player.activeBalloons++;
  }

  update(time, delta) {
    if (this.player1) this.player1.update();
    if (this.player2) this.player2.update();
  }
}
