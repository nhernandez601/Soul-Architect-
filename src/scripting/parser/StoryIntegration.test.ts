/**
 * End-to-end story integration — parse real story files and drive them
 * through the ending system to prove the parser output is runtime-shaped.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ScriptParser } from './ScriptParser';
import { SoulSystem } from '../../systems/soul/SoulSystem';
import { EndingSystem } from '../../systems/ending/EndingSystem';
import { AchievementSystem } from '../../systems/achievement/AchievementSystem';
import { registry } from '../../engine/core/ServiceRegistry';
import { engineBus } from '../../engine/core/EventBus';
import { ENDING_DEFINITIONS } from '../../data/endingDefinitions';
import { ACHIEVEMENT_DEFINITIONS } from '../../data/achievementDefinitions';

const STORY_DIR = join(__dirname, '../../../story');
const parser = new ScriptParser();

function readAllStoryFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...readAllStoryFiles(full));
    else if (entry.name.endsWith('.sasl')) results.push(full);
  }
  return results;
}

describe('story integration', () => {
  let soul: SoulSystem;
  let ending: EndingSystem;
  let achievement: AchievementSystem;

  beforeEach(async () => {
    engineBus.removeAllListeners();
    registry.destroyAll();

    soul = new SoulSystem();
    await soul.init();
    await soul.start();
    registry.register('soul', soul);

    ending = new EndingSystem();
    await ending.init();
    await ending.start();
    ending.registerEndings(ENDING_DEFINITIONS);
    registry.register('ending', ending);

    achievement = new AchievementSystem();
    await achievement.init();
    await achievement.start();
    achievement.registerAchievements(ACHIEVEMENT_DEFINITIONS);
    registry.register('achievement', achievement);
  });

  afterEach(() => { registry.destroyAll(); });

  // ---------------------------------------------------------------------------
  // Parser can consume every real story file without throwing
  // ---------------------------------------------------------------------------

  describe('parser', () => {
    it('parses every .sasl file in story/ without error', () => {
      const files = readAllStoryFiles(STORY_DIR);
      expect(files.length).toBeGreaterThan(10);
      for (const file of files) {
        const source = readFileSync(file, 'utf-8');
        expect(() => parser.parse(source), file).not.toThrow();
      }
    });

    it('parses at least 100 scenes from the full story', () => {
      const files = readAllStoryFiles(STORY_DIR);
      const totalScenes = files.reduce(
        (n, f) => n + parser.parse(readFileSync(f, 'utf-8')).length,
        0,
      );
      expect(totalScenes).toBeGreaterThanOrEqual(100);
    });
  });

  // ---------------------------------------------------------------------------
  // End-to-end ending trigger via bus
  // ---------------------------------------------------------------------------

  describe('ending → achievement pipeline', () => {
    it('triggers the true ending when purpose ≥ 50 and compassion ≥ 40', () => {
      // starting soul: purpose=50, compassion=50 — conditions already met
      engineBus.emit('scene:end', { sceneId: 'ending_check_true_seeker' });
      expect(ending.getRecord('ending_true_seeker')?.seenCount).toBe(1);
    });

    it('unlocks threshold_keeper achievement when the true ending is reached', () => {
      engineBus.emit('scene:end', { sceneId: 'ending_check_true_seeker' });
      expect(achievement.getAchievement('threshold_keeper')?.unlockedAt).toBeDefined();
    });

    it('triggers the corrupted ending when shadow ≥ 60', () => {
      soul.applyDelta({ shadow: 40 }, 'test'); // 20 + 40 = 60
      engineBus.emit('scene:end', { sceneId: 'ending_corrupted_approach' });
      expect(ending.getRecord('ending_corrupted')?.seenCount).toBe(1);
      expect(achievement.getAchievement('into_the_dark')?.unlockedAt).toBeDefined();
    });

    it('triggers the guardian ending when compassion ≥ 50, love ≥ 40, fear ≤ 20', () => {
      // Defaults: compassion=50, love=50, fear=10 — all met from the start
      engineBus.emit('scene:end', { sceneId: 'ending_guardian_approach' });
      expect(ending.getRecord('ending_good_guardian')?.seenCount).toBe(1);
    });

    it('falls back to the neutral ending when its trigger scene fires with no conditions', () => {
      engineBus.emit('scene:end', { sceneId: 'ending_neutral_threshold' });
      expect(ending.getRecord('ending_neutral_threshold')?.seenCount).toBe(1);
    });

    it('blocks the transcendent ending on a first playthrough', () => {
      // meet all soul conditions
      soul.applyDelta({
        purpose: 10, compassion: 10, hope: 10, knowledge: 10, love: 10,
      }, 'test');
      // even flags set — NG+ is what gates it
      engineBus.emit('flag:set', { key: 'all_codex_unlocked', value: true });
      engineBus.emit('flag:set', { key: 'nyx_shadow_shared', value: true });
      engineBus.emit('flag:set', { key: 'echo_first_meeting', value: true });

      engineBus.emit('scene:end', { sceneId: 'ending_transcendent_approach' });
      expect(ending.getRecord('ending_transcendent')?.seenCount).toBe(0);
    });

    it('allows the transcendent ending after beginNGPlus with all conditions met', () => {
      soul.applyDelta({
        purpose: 10, compassion: 10, hope: 10, knowledge: 10, love: 10,
      }, 'test');
      engineBus.emit('flag:set', { key: 'all_codex_unlocked', value: true });
      engineBus.emit('flag:set', { key: 'nyx_shadow_shared', value: true });
      engineBus.emit('flag:set', { key: 'echo_first_meeting', value: true });

      ending.beginNGPlus(['all_codex_unlocked', 'nyx_shadow_shared', 'echo_first_meeting']);
      engineBus.emit('scene:end', { sceneId: 'ending_transcendent_approach' });

      expect(ending.getRecord('ending_transcendent')?.seenCount).toBe(1);
      expect(achievement.getAchievement('voice_found')?.unlockedAt).toBeDefined();
      expect(achievement.getAchievement('the_loop_closes')?.unlockedAt).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Full pipeline: parse Chapter 2 finale, verify its `if` branches emit
  // the right goto nodes.
  // ---------------------------------------------------------------------------

  describe('chapter_02_finale', () => {
    it('parses the finale dispatcher scene from disk', () => {
      const source = readFileSync(
        join(STORY_DIR, 'scenes/chapter_02_the_name.sasl'),
        'utf-8',
      );
      const scenes = parser.parse(source);
      const finale = scenes.find((s) => s.id === 'chapter_02_finale');
      expect(finale).toBeDefined();
      const gotos = finale!.nodes.filter((n) => n.type === 'goto') as
        { type: 'goto'; targetSceneId: string }[];
      const targets = new Set(gotos.map((g) => g.targetSceneId));
      // Every ending trigger scene must be reachable from the dispatcher.
      expect(targets.has('ending_check_true_seeker')).toBe(true);
      expect(targets.has('ending_guardian_approach')).toBe(true);
      expect(targets.has('ending_corrupted_approach')).toBe(true);
      expect(targets.has('ending_transcendent_approach')).toBe(true);
      expect(targets.has('ending_neutral_threshold')).toBe(true);
    });
  });
});
