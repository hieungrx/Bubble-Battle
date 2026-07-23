export function gridToWorld(row, col, tileSize) {
  return {
    x: col * tileSize + tileSize / 2,
    y: row * tileSize + tileSize / 2,
  };
}

export function worldToGrid(x, y, tileSize) {
  return {
    row: Math.floor(y / tileSize),
    col: Math.floor(x / tileSize),
  };
}
