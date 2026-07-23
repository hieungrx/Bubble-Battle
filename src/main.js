import Phaser from 'phaser';
import { config } from './config.js';

const game = new Phaser.Game(config);
if (import.meta.env.DEV || import.meta.env.MODE === 'test' || true) {
  window.__BUBBLE_BATTLE_GAME__ = game;
}
