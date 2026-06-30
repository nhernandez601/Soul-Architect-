import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EndingSystem } from './EndingSystem';
import { SoulSystem } from '../soul/SoulSystem';
import { registry } from '../../engine/core/ServiceRegistry';
import { engineBus } from '../../engine/core/EventBus';
import type { EndingDefinition } from './EndingSystem';

const makeEnding = (overrides: Partial<EndingDefinition> = {}): EndingDefinition => ({
  id: 'test_ending',
  title: 'Test Ending',
  subtitle: 'Test',
  description: 'A test ending.',
  category: 'good',
  conditions: {},
  triggerScene: 'test_scene',
  isSecret: false,
  ...overrides,
});

describe('EndingSystem', () => {
  let ending: EndingSystem;
  let soul: SoulSystem;

  beforeEach(async () => {
    engineBus.removeAllListeners();
    registry.destroyAll();

    soul = new SoulSystem();
    await soul.init();
    await soul.start();

    // Register so EndingSystem.meetsConditions can look it up
    registry.register('soul', soul);

    ending = new EndingSystem();
    await ending.init();
    await ending.start();
  });

  afterEach(() => {
    registry.destroyAll();
  });

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  describe('registerEnding', () => {
    it('stores the ending definition', () => {
      ending.registerEnding(makeEnding());
      expect(ending.getDefinition('test_ending')).toBeDefined();
    });

    it('creates an unseen record with seenCount 0', () => {
      ending.registerEnding(makeEnding());
      const rec = ending.getRecord('test_ending');
      expect(rec?.seenCount).toBe(0);
    });

    it('registerEndings registers multiple at once', () => {
      ending.registerEndings([
        makeEnding({ id: 'e1' }),
        makeEnding({ id: 'e2' }),
      ]);
      expect(ending.getDefinition('e1')).toBeDefined();
      expect(ending.getDefinition('e2')).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // meetsConditions
  // ---------------------------------------------------------------------------

  describe('meetsConditions via reachEnding', () => {
    it('reaches ending when conditions are empty', () => {
      ending.registerEnding(makeEnding());
      ending.reachEnding('test_ending');
      expect(ending.getRecord('test_ending')?.seenCount).toBe(1);
    });

    it('does not reach ending when soul condition fails', () => {
      ending.registerEnding(makeEnding({
        conditions: {
          soul: [{ attribute: 'purpose', operator: '>=', value: 999 }],
        },
      }));
      // checkEndingTriggers is private; call reachEnding directly and check via scene trigger
      // Verify meetsConditions indirectly: trigger scene that fires scene:end
      engineBus.emit('scene:end', { sceneId: 'test_scene' });
      expect(ending.getRecord('test_ending')?.seenCount).toBe(0);
    });

    it('reaches ending when soul condition passes', () => {
      soul.applyDelta({ purpose: 50 }, 'test'); // purpose default 50 + 50 = 100
      ending.registerEnding(makeEnding({
        conditions: {
          soul: [{ attribute: 'purpose', operator: '>=', value: 90 }],
        },
      }));
      engineBus.emit('scene:end', { sceneId: 'test_scene' });
      expect(ending.getRecord('test_ending')?.seenCount).toBe(1);
    });

    it('blocks NG+ ending when not in NG+', () => {
      ending.registerEnding(makeEnding({
        conditions: { requiresNGPlus: true },
      }));
      engineBus.emit('scene:end', { sceneId: 'test_scene' });
      expect(ending.getRecord('test_ending')?.seenCount).toBe(0);
    });

    it('allows NG+ ending after beginNGPlus', () => {
      ending.registerEnding(makeEnding({
        conditions: { requiresNGPlus: true },
      }));
      ending.beginNGPlus([]);
      engineBus.emit('scene:end', { sceneId: 'test_scene' });
      expect(ending.getRecord('test_ending')?.seenCount).toBe(1);
    });

    it('evaluates flag conditions correctly', () => {
      engineBus.emit('flag:set', { key: 'nyx_met', value: true });
      ending.registerEnding(makeEnding({
        conditions: { flags: { nyx_met: true } },
      }));
      engineBus.emit('scene:end', { sceneId: 'test_scene' });
      expect(ending.getRecord('test_ending')?.seenCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getCompletionPercent
  // ---------------------------------------------------------------------------

  describe('getCompletionPercent', () => {
    it('returns 0 when nothing seen', () => {
      ending.registerEndings([
        makeEnding({ id: 'e1' }),
        makeEnding({ id: 'e2' }),
      ]);
      expect(ending.getCompletionPercent()).toBe(0);
    });

    it('returns 50 when half seen', () => {
      ending.registerEndings([
        makeEnding({ id: 'e1' }),
        makeEnding({ id: 'e2' }),
      ]);
      ending.reachEnding('e1');
      expect(ending.getCompletionPercent()).toBe(50);
    });

    it('returns 100 when all non-secret endings seen', () => {
      ending.registerEndings([
        makeEnding({ id: 'e1' }),
        makeEnding({ id: 'e2' }),
        makeEnding({ id: 'secret', isSecret: true }), // excluded from percent
      ]);
      ending.reachEnding('e1');
      ending.reachEnding('e2');
      expect(ending.getCompletionPercent()).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // NG+
  // ---------------------------------------------------------------------------

  describe('beginNGPlus', () => {
    it('increments playthrough number', () => {
      expect(ending.getPlaythroughNumber()).toBe(1);
      ending.beginNGPlus([]);
      expect(ending.getPlaythroughNumber()).toBe(2);
    });

    it('sets ng_plus flag via bus', () => {
      const received: boolean[] = [];
      engineBus.on('flag:set', ({ key, value }) => {
        if (key === 'ng_plus') received.push(value as boolean);
      });
      ending.beginNGPlus([]);
      expect(received).toContain(true);
    });

    it('inherits specified flags from soul', () => {
      engineBus.emit('flag:set', { key: 'nyx_met', value: true });
      ending.beginNGPlus(['nyx_met']);
      const state = ending.getNGPlusState();
      expect(state.inheritedFlags['nyx_met']).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // serialize / deserialize
  // ---------------------------------------------------------------------------

  describe('serialize / deserialize', () => {
    it('round-trips seen ending records', () => {
      ending.registerEnding(makeEnding());
      ending.reachEnding('test_ending');
      const data = ending.serialize();

      const ending2 = new EndingSystem();
      ending2.registerEnding(makeEnding());
      ending2.deserialize(data);

      expect(ending2.getRecord('test_ending')?.seenCount).toBe(1);
    });

    it('round-trips NG+ state', () => {
      ending.beginNGPlus([]);
      const data = ending.serialize();

      const ending2 = new EndingSystem();
      ending2.deserialize(data);

      expect(ending2.getNGPlusState().enabled).toBe(true);
      expect(ending2.getNGPlusState().playthroughNumber).toBe(2);
    });
  });
});
