import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipSystem } from './RelationshipSystem';
import { engineBus } from '../../engine/core/EventBus';
import type { CharacterID } from '@t/character';

const NYX = 'nyx' as CharacterID;
const ECHO = 'echo' as CharacterID;

describe('RelationshipSystem', () => {
  let rel: RelationshipSystem;

  beforeEach(async () => {
    engineBus.removeAllListeners();
    rel = new RelationshipSystem();
    await rel.init();
    await rel.start();
  });

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  describe('registerCharacter', () => {
    it('registers a character with zeroed stats', () => {
      rel.registerCharacter(NYX);
      const stats = rel.getStats(NYX);
      expect(stats?.affinity).toBe(0);
      expect(stats?.trust).toBe(0);
    });

    it('does not overwrite an existing registration', () => {
      rel.registerCharacter(NYX);
      rel.applyDelta(NYX, 'trust', 20);
      rel.registerCharacter(NYX); // second registration
      expect(rel.getStats(NYX)?.trust).toBe(20);
    });
  });

  // ---------------------------------------------------------------------------
  // applyDelta
  // ---------------------------------------------------------------------------

  describe('applyDelta', () => {
    it('increases trust', () => {
      rel.registerCharacter(NYX);
      rel.applyDelta(NYX, 'trust', 30);
      expect(rel.getStats(NYX)?.trust).toBe(30);
    });

    it('clamps trust to 100 maximum', () => {
      rel.registerCharacter(NYX);
      rel.applyDelta(NYX, 'trust', 150);
      expect(rel.getStats(NYX)?.trust).toBe(100);
    });

    it('clamps affinity to 0 minimum', () => {
      rel.registerCharacter(NYX);
      rel.applyDelta(NYX, 'affinity', -50);
      expect(rel.getStats(NYX)?.affinity).toBe(0);
    });

    it('emits relationship:change with correct payload', () => {
      rel.registerCharacter(NYX);
      const handler = vi.fn();
      engineBus.on('relationship:change', handler);
      rel.applyDelta(NYX, 'trust', 10);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ characterId: NYX, stat: 'trust', delta: 10, newValue: 10 })
      );
    });

    it('warns and does nothing for unregistered character', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      rel.applyDelta(ECHO, 'trust', 10);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // getAllStats / serialize
  // ---------------------------------------------------------------------------

  describe('getAllStats', () => {
    it('returns stats for all registered characters', () => {
      rel.registerCharacter(NYX);
      rel.registerCharacter(ECHO);
      rel.applyDelta(NYX, 'trust', 15);
      rel.applyDelta(ECHO, 'affinity', 25);
      const all = rel.getAllStats();
      expect(all[NYX]?.trust).toBe(15);
      expect(all[ECHO]?.affinity).toBe(25);
    });
  });
});
