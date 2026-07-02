import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AchievementSystem } from './AchievementSystem';
import { SoulSystem } from '../soul/SoulSystem';
import { registry } from '../../engine/core/ServiceRegistry';
import { engineBus } from '../../engine/core/EventBus';
import type { AchievementDefinition } from './AchievementSystem';

const makeDef = (overrides: Partial<AchievementDefinition> = {}): AchievementDefinition => ({
  id: 'test_ach',
  title: 'Test',
  description: 'Test achievement',
  iconPath: '',
  category: 'story',
  isSecret: false,
  points: 10,
  ...overrides,
});

describe('AchievementSystem', () => {
  let ach: AchievementSystem;
  let soul: SoulSystem;

  beforeEach(async () => {
    engineBus.removeAllListeners();
    registry.destroyAll();

    soul = new SoulSystem();
    await soul.init();
    await soul.start();
    registry.register('soul', soul);

    ach = new AchievementSystem();
    await ach.init();
    await ach.start();
  });

  afterEach(() => { registry.destroyAll(); });

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  describe('registerAchievement', () => {
    it('stores the definition and creates a locked record', () => {
      ach.registerAchievement(makeDef());
      const a = ach.getAchievement('test_ach');
      expect(a?.title).toBe('Test');
      expect(a?.unlockedAt).toBeUndefined();
    });

    it('initializes progress to 0 when progressMax is set', () => {
      ach.registerAchievement(makeDef({ progressMax: 5 }));
      const a = ach.getAchievement('test_ach');
      expect(a?.progress).toBe(0);
      expect(a?.maxProgress).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // Unlock paths
  // ---------------------------------------------------------------------------

  describe('unlock', () => {
    it('sets unlockedAt timestamp and emits achievement:unlocked', () => {
      ach.registerAchievement(makeDef());
      let emittedId: string | undefined;
      engineBus.on('achievement:unlocked', ({ achievementId }) => { emittedId = achievementId; });
      ach.unlock('test_ach');
      expect(ach.getAchievement('test_ach')?.unlockedAt).toBeDefined();
      expect(emittedId).toBe('test_ach');
    });

    it('is idempotent — unlocking twice does not re-fire event', () => {
      ach.registerAchievement(makeDef());
      let count = 0;
      engineBus.on('achievement:unlocked', () => { count++; });
      ach.unlock('test_ach');
      ach.unlock('test_ach');
      expect(count).toBe(1);
    });

    it('does nothing for unknown id', () => {
      let fired = false;
      engineBus.on('achievement:unlocked', () => { fired = true; });
      ach.unlock('nonexistent');
      expect(fired).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Trigger paths
  // ---------------------------------------------------------------------------

  describe('flag trigger', () => {
    it('unlocks when triggerFlag is set via flag:set', () => {
      ach.registerAchievement(makeDef({ triggerFlag: 'my_flag' }));
      engineBus.emit('flag:set', { key: 'my_flag', value: true });
      expect(ach.getAchievement('test_ach')?.unlockedAt).toBeDefined();
    });
  });

  describe('scene trigger', () => {
    it('unlocks when triggerScene fires scene:end', () => {
      ach.registerAchievement(makeDef({ triggerScene: 'chapter_02_start' }));
      engineBus.emit('scene:end', { sceneId: 'chapter_02_start' });
      expect(ach.getAchievement('test_ach')?.unlockedAt).toBeDefined();
    });
  });

  describe('ending trigger', () => {
    it('unlocks when ending:reached matches triggerEnding', () => {
      ach.registerAchievement(makeDef({ triggerEnding: 'ending_true_seeker' }));
      engineBus.emit('ending:reached', { endingId: 'ending_true_seeker', isNewEnding: true });
      expect(ach.getAchievement('test_ach')?.unlockedAt).toBeDefined();
    });

    it('does not unlock for a different ending', () => {
      ach.registerAchievement(makeDef({ triggerEnding: 'ending_true_seeker' }));
      engineBus.emit('ending:reached', { endingId: 'ending_corrupted', isNewEnding: true });
      expect(ach.getAchievement('test_ach')?.unlockedAt).toBeUndefined();
    });
  });

  describe('condition trigger', () => {
    it('unlocks when soul condition becomes true', () => {
      ach.registerAchievement(makeDef({
        condition: [{ attribute: 'compassion', operator: '>=', value: 80 }],
      }));
      soul.applyDelta({ compassion: 40 }, 'test'); // 50 + 40 = 90
      expect(ach.getAchievement('test_ach')?.unlockedAt).toBeDefined();
    });

    it('does not unlock when condition is not yet met', () => {
      ach.registerAchievement(makeDef({
        condition: [{ attribute: 'compassion', operator: '>=', value: 80 }],
      }));
      soul.applyDelta({ compassion: 10 }, 'test'); // 50 + 10 = 60
      expect(ach.getAchievement('test_ach')?.unlockedAt).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Progress tracking
  // ---------------------------------------------------------------------------

  describe('progress', () => {
    it('setProgress clamps to maxProgress and unlocks when reached', () => {
      ach.registerAchievement(makeDef({ progressMax: 3 }));
      ach.setProgress('test_ach', 3);
      expect(ach.getAchievement('test_ach')?.unlockedAt).toBeDefined();
    });

    it('incrementProgress accumulates', () => {
      ach.registerAchievement(makeDef({ progressMax: 3 }));
      ach.incrementProgress('test_ach');
      ach.incrementProgress('test_ach');
      expect(ach.getAchievement('test_ach')?.progress).toBe(2);
      expect(ach.getAchievement('test_ach')?.unlockedAt).toBeUndefined();
    });

    it('flag:set updates progressFlag-linked achievements', () => {
      ach.registerAchievement(makeDef({ progressMax: 10, progressFlag: 'kills' }));
      engineBus.emit('flag:set', { key: 'kills', value: 7 });
      expect(ach.getAchievement('test_ach')?.progress).toBe(7);
    });
  });

  // ---------------------------------------------------------------------------
  // Queries + serialization
  // ---------------------------------------------------------------------------

  describe('queries', () => {
    it('getCompletionPercent reflects unlocked ratio', () => {
      ach.registerAchievements([makeDef({ id: 'a' }), makeDef({ id: 'b' })]);
      ach.unlock('a');
      expect(ach.getCompletionPercent()).toBe(50);
    });

    it('getTotalPoints sums points of unlocked achievements only', () => {
      ach.registerAchievements([
        makeDef({ id: 'a', points: 10 }),
        makeDef({ id: 'b', points: 25 }),
      ]);
      ach.unlock('a');
      expect(ach.getTotalPoints()).toBe(10);
    });
  });

  describe('serialize / deserialize', () => {
    it('round-trips unlock state', () => {
      ach.registerAchievement(makeDef());
      ach.unlock('test_ach');
      const data = ach.serialize();

      const ach2 = new AchievementSystem();
      ach2.registerAchievement(makeDef());
      ach2.deserialize(data);
      expect(ach2.getAchievement('test_ach')?.unlockedAt).toBeDefined();
    });
  });
});
