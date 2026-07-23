import { TILE } from '../constants/tileTypes.js';
import { GAME_RULES } from '../constants/gameRules.js';
import { gridToWorld, worldToGrid } from '../utils/grid.js';

export default class GridMapSystem {
  constructor(scene, levelData) {
    this.scene = scene;
    // Clone level data so we can mutate it (e.g., removing crates)
    this.mapData = levelData.map(row => [...row]);
    this.tileSize = GAME_RULES.tileSize;

    this.walls = this.scene.physics.add.staticGroup();
    this.crates = this.scene.physics.add.staticGroup();

    this.crateSprites = new Map(); // to keep track of crate sprites by row-col key
  }

  buildMap() {
    for (let row = 0; row < this.mapData.length; row++) {
      for (let col = 0; col < this.mapData[row].length; col++) {
        const tile = this.mapData[row][col];
        const { x, y } = gridToWorld(row, col, this.tileSize);

        // Floor: Dark Blue-Gray with subtle grid borders
        const floorRect = this.scene.add.rectangle(x, y, this.tileSize, this.tileSize, 0x1e293b);
        floorRect.setStrokeStyle(1, 0x0f172a);

        if (tile === TILE.WALL) {
          // Solid Wall: Steel Slate Gray with crisp border
          const wall = this.scene.add.rectangle(x, y, this.tileSize, this.tileSize, 0x475569);
          wall.setStrokeStyle(2, 0x334155);
          this.walls.add(wall);
        } else if (tile === TILE.CRATE) {
          // Destructible Crate: Warm Amber Wood Brown with dark outline
          const crate = this.scene.add.rectangle(x, y, this.tileSize, this.tileSize, 0xd97706);
          crate.setStrokeStyle(2, 0x92400e);
          this.crates.add(crate);
          this.crateSprites.set(`${row}-${col}`, crate);
        }
      }
    }
  }

  getTileAt(row, col) {
    if (row < 0 || row >= this.mapData.length || col < 0 || col >= this.mapData[0].length) {
      return TILE.WALL; // Out of bounds treated as wall
    }
    return this.mapData[row][col];
  }

  removeCrate(row, col) {
    if (this.getTileAt(row, col) === TILE.CRATE) {
      this.mapData[row][col] = TILE.FLOOR;
      const key = `${row}-${col}`;
      const sprite = this.crateSprites.get(key);
      if (sprite) {
        sprite.destroy();
        this.crateSprites.delete(key);
      }
    }
  }
}
