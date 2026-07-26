import Phaser from 'phaser';
import { GAME_RULES } from '../constants/gameRules.js';
import { gridToWorld } from '../utils/grid.js';
import { QUIZ_DROP_RULES } from '../utils/quizDrops.js';

let nextItemId = 0;

export function resetQuizItemIdCounter() {
  nextItemId = 0;
}

export default class QuizItem extends Phaser.GameObjects.Container {
  constructor(scene, gridRow, gridCol, lifetime = QUIZ_DROP_RULES.itemLifetimeMs) {
    const { x, y } = gridToWorld(gridRow, gridCol, GAME_RULES.tileSize);
    super(scene, x, y);

    this.itemId = ++nextItemId;
    this.scene = scene;
    this.gridRow = gridRow;
    this.gridCol = gridCol;
    this.collected = false;
    this.claimed = false;
    this.claimedByPlayerId = null;
    this.lifetime = lifetime;

    const box = scene.add.rectangle(0, 0, 28, 28, 0xffd700);
    box.setStrokeStyle(2, 0xb8860b);
    this.add(box);

    const label = scene.add.text(0, 0, '?', {
      fontSize: '18px',
      fill: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add(label);

    this.setDepth(5);
    this.setSize(28, 28);

    this.pulseTween = scene.tweens.add({
      targets: box,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.lifetimeTimer = scene.time.delayedCall(this.lifetime, () => {
      if (this.active && !this.collected) {
        this.scene.events.emit('quiz_item_despawned', this);
      }
    });
  }

  claim(player) {
    if (this.claimed || this.collected || !this.active) {
      return false;
    }
    this.claimed = true;
    this.claimedByPlayerId = player.id;
    this.collected = true;
    if (this.lifetimeTimer) {
      this.lifetimeTimer.remove(false);
      this.lifetimeTimer = null;
    }
    this.body.enable = false;
    return true;
  }

  collect() {
    if (this.collected) return;
    this.collected = true;
    if (this.lifetimeTimer) {
      this.lifetimeTimer.remove(false);
      this.lifetimeTimer = null;
    }
    this.body.enable = false;
  }

  destroy() {
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween.remove();
      this.pulseTween = null;
    }
    if (this.lifetimeTimer) {
      this.lifetimeTimer.remove(false);
      this.lifetimeTimer = null;
    }
    this.collected = true;
    this.claimed = true;
    super.destroy();
  }
}
