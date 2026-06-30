import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SoulSystem } from './SoulSystem';
import { engineBus } from '../../engine/core/EventBus';

describe('SoulSystem', () => {
  let soul: SoulSystem;

  beforeEach(async () => {
    engineBus.removeAllListeners();
    soul = new SoulSystem();
    await soul.init();
    await soul.start();
  });

  // ---------------------------------------------------------------------------
  // applyDelta
  // ---------------------------------------------------------------------------

  describe('applyDelta', () => {
    it('adds positive delta to a stat', () => {
      soul.applyDelta({ purpose: 10 }, 'test');
      expect(soul.getAttribute('purpose')).toBe(60); // default 50 + 10
    });

    it('subtracts negative delta', () => {
      soul.applyDelta({ fear: -5 }, 'test');
      expect(soul.getAttribute('fear')).toBe(5); // default 10 - 5
    });

    it('clamps stat to 100 maximum', () => {
      soul.applyDelta({ hope: 100 }, 'test');
      expect(soul.getAttribute('hope')).toBe(100);
    });

    it('clamps stat to 0 minimum', () => {
      soul.applyDelta({ regret: -100 }, 'test');
      expect(soul.getAttribute('regret')).toBe(0);
    });

    it('applies multiple stats in a single delta', () => {
      soul.applyDelta({ purpose: 5, compassion: 10, shadow: -3 }, 'test');
      expect(soul.getAttribute('purpose')).toBe(55);
      expect(soul.getAttribute('compassion')).toBe(60);
      expect(soul.getAttribute('shadow')).toBe(17); // default 20 - 3
    });

    it('emits soul:attribute_change with correct payload', () => {
      const handler = vi.fn();
      engineBus.on('soul:attribute_change', handler);
      soul.applyDelta({ hope: 5 }, 'test');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ attribute: 'hope', oldValue: 50, newValue: 55 })
      );
    });

    it('emits soul:change event', () => {
      const handler = vi.fn();
      engineBus.on('soul:change', handler);
      soul.applyDelta({ knowledge: 3 }, 'scene_01');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'scene_01' })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // evaluateCondition
  // ---------------------------------------------------------------------------

  describe('evaluateCondition', () => {
    it('evaluates >= correctly when met', () => {
      expect(soul.evaluateCondition({ attribute: 'purpose', operator: '>=', value: 50 })).toBe(true);
    });

    it('evaluates >= correctly when not met', () => {
      expect(soul.evaluateCondition({ attribute: 'purpose', operator: '>=', value: 51 })).toBe(false);
    });

    it('evaluates > strictly', () => {
      expect(soul.evaluateCondition({ attribute: 'purpose', operator: '>', value: 49 })).toBe(true);
      expect(soul.evaluateCondition({ attribute: 'purpose', operator: '>', value: 50 })).toBe(false);
    });

    it('evaluates <= correctly', () => {
      expect(soul.evaluateCondition({ attribute: 'fear', operator: '<=', value: 10 })).toBe(true);
      expect(soul.evaluateCondition({ attribute: 'fear', operator: '<=', value: 9 })).toBe(false);
    });

    it('evaluates == correctly', () => {
      expect(soul.evaluateCondition({ attribute: 'fear', operator: '==', value: 10 })).toBe(true);
      expect(soul.evaluateCondition({ attribute: 'fear', operator: '==', value: 11 })).toBe(false);
    });

    it('evaluates != correctly', () => {
      expect(soul.evaluateCondition({ attribute: 'fear', operator: '!=', value: 99 })).toBe(true);
      expect(soul.evaluateCondition({ attribute: 'fear', operator: '!=', value: 10 })).toBe(false);
    });

    it('evaluates between range correctly', () => {
      expect(soul.evaluateCondition({ attribute: 'hope', operator: 'between', value: 40, value2: 60 })).toBe(true);
      expect(soul.evaluateCondition({ attribute: 'hope', operator: 'between', value: 60, value2: 80 })).toBe(false);
    });

    it('evaluates a condition against a flag (boolean)', () => {
      engineBus.emit('flag:set', { key: 'nyx_met', value: true });
      expect(soul.evaluateCondition({ attribute: 'nyx_met', operator: '==', value: true })).toBe(true);
    });

    it('returns 0 (false) for unknown attributes', () => {
      expect(soul.evaluateCondition({ attribute: 'nonexistent' as never, operator: '>', value: 0 })).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Flags
  // ---------------------------------------------------------------------------

  describe('flags', () => {
    it('getFlag returns undefined for unset flags', () => {
      expect(soul.getFlag('unknown')).toBeUndefined();
    });

    it('getFlag returns the value set via flag:set event', () => {
      engineBus.emit('flag:set', { key: 'echo_met', value: true });
      expect(soul.getFlag('echo_met')).toBe(true);
    });

    it('supports string flag values', () => {
      engineBus.emit('flag:set', { key: 'path_taken', value: 'shadow' });
      expect(soul.getFlag('path_taken')).toBe('shadow');
    });

    it('supports numeric flag values', () => {
      engineBus.emit('flag:set', { key: 'playthroughs', value: 3 });
      expect(soul.getFlag('playthroughs')).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // getState / loadState round-trip
  // ---------------------------------------------------------------------------

  describe('getState / loadState', () => {
    it('serializes and restores soul stats', () => {
      soul.applyDelta({ purpose: 20, shadow: 15 }, 'test');
      const state = soul.getState();

      const soul2 = new SoulSystem();
      soul2.loadState(state);

      expect(soul2.getAttribute('purpose')).toBe(70);
      expect(soul2.getAttribute('shadow')).toBe(35);
    });

    it('restores archetype after loadState', () => {
      const state = soul.getState();
      state.archetype = 'guardian';
      soul.loadState(state);
      expect(soul.archetype).toBe('guardian');
    });
  });
});
