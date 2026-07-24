import Phaser from 'phaser';
import { config } from './config.js';

const game = new Phaser.Game(config);
if (
  import.meta.env.DEV ||
  import.meta.env.VITE_ENABLE_TEST_HOOKS === 'true'
) {
  window.__BUBBLE_BATTLE_GAME__ = game;
  import('./constants/gameStates.js').then((module) => {
    window.__BUBBLE_BATTLE_TEST_API__ = {
      game,
      states: {
        player: module.PLAYER_STATE,
        round: module.ROUND_STATE
      }
    };
  });
}
