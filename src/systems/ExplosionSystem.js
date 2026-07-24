import { TILE } from '../constants/tileTypes.js';
import { GAME_RULES } from '../constants/gameRules.js';
import { gridToWorld } from '../utils/grid.js';

const DIRECTIONS = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

export default class ExplosionSystem {
  constructor(scene, mapSystem) {
    this.scene = scene;
    this.mapSystem = mapSystem;
    this.explosions = this.scene.physics.add.staticGroup();
  }

  handleExplosion(data) {
    const { row: centerRow, col: centerCol, range } = data;

    // Create center explosion
    this.createExplosionHitbox(centerRow, centerCol);

    // Spread in 4 directions
    for (const dir of DIRECTIONS) {
      for (let i = 1; i <= range; i++) {
        const r = centerRow + dir.row * i;
        const c = centerCol + dir.col * i;

        const tile = this.mapSystem.getTileAt(r, c);

        if (tile === TILE.WALL) {
          break; // Stop at wall
        }

        if (tile === TILE.CRATE) {
          // Break crate and stop
          this.createExplosionHitbox(r, c);
          this.mapSystem.removeCrate(r, c);
          break;
        }

        // Floor - continue expanding
        this.createExplosionHitbox(r, c);
      }
    }
  }

  createExplosionHitbox(row, col) {
    const { x, y } = gridToWorld(row, col, GAME_RULES.tileSize);
    const explosion = this.scene.add.rectangle(x, y, GAME_RULES.tileSize, GAME_RULES.tileSize, 0xf59e0b); // Fire amber explosion
    explosion.setStrokeStyle(2, 0xef4444); // Red outer blast line
    
    this.explosions.add(explosion);

    // Cleanup after explosionDuration
    this.scene.time.delayedCall(GAME_RULES.explosionDuration, () => {
      if (explosion.active) explosion.destroy();
    });
  }

  destroy() {
    if (this.explosions) {
      try {
        this.explosions.clear(true, true);
      } catch (e) {
        // Ignored during scene shutdown
      }
    }
  }
}
